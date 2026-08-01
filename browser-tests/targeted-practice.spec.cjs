const { test, expect } = require('@playwright/test');

async function declineAnalytics(page) {
  const button = page.getByRole('button', { name: 'Decline analytics' });
  if (await button.count()) await button.click();
}

async function openPractice(page, path = '/targeted-practice.html') {
  await page.goto(path);
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-targeted-practice-ready', 'true');
}

async function startPractice(page) {
  await page.locator('[data-start-practice]').click();
  await expect(page.locator('#practiceWorkspace')).toBeVisible();
  await expect(page.locator('[data-practice-grid] button')).toHaveCount(10);
}

async function answerCurrentCorrectly(page) {
  const correct = await page.locator('[data-question-mount] fieldset').getAttribute('data-correct');
  await page.locator(`[data-question-mount] input[value="${correct}"]`).check();
}

async function selectOnlyDomain(page, domain) {
  await page.locator('input[name="domains"]').evaluateAll((items, selected) => items.forEach((item) => {
    item.checked = item.value === selected;
    item.dispatchEvent(new Event('change', { bubbles: true }));
  }), domain);
}

test('Targeted Practice is a noindex Premium preview with transparent review status', async ({ page }) => {
  await openPractice(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-targeted-bank-total]')).toHaveText('150');
  await expect(page.locator('[data-pool-count]')).toContainText('150 matching questions');
  await expect(page.getByText('Premium preview.')).toBeVisible();
  await expect(page.getByText(/70 base questions reviewed; 80 alternate scenarios in final review/)).toBeVisible();
});

test('at least one exam domain and difficulty are required', async ({ page }) => {
  await openPractice(page);
  await page.locator('input[name="domains"]').evaluateAll((items) => items.forEach((item) => {
    item.checked = false;
    item.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  await expect(page.locator('[data-pool-count]')).toContainText('Choose at least one exam domain.');
  await expect(page.locator('[data-start-practice]')).toBeDisabled();

  await page.locator('input[name="domains"]').first().check();
  await page.locator('input[name="difficulties"]').evaluateAll((items) => items.forEach((item) => {
    item.checked = false;
    item.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  await expect(page.locator('[data-pool-count]')).toContainText('Choose at least one difficulty level.');
  await expect(page.locator('[data-start-practice]')).toBeDisabled();
});

test('Study mode gives immediate feedback and restores a saved set', async ({ page }) => {
  await openPractice(page);
  await startPractice(page);
  await answerCurrentCorrectly(page);
  await page.locator('[data-check-answer]').click();
  await expect(page.locator('[data-question-mount] fieldset')).toHaveClass(/correct/);
  await expect(page.locator('[data-question-mount] .explanation')).toBeVisible();
  await page.locator('[data-practice-flag]').click();
  await page.locator('[data-practice-next]').click();

  await expect.poll(() => page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('free-htl-progress-v1'));
    return record?.activeSessions?.['targeted-practice']?.currentIndex;
  })).toBe(1);

  await page.reload();
  await declineAnalytics(page);
  await expect(page.locator('[data-resume-practice]')).toBeVisible();
  await page.locator('[data-resume-practice]').click();
  await expect(page.locator('[data-practice-position]')).toHaveText('2 of 10');
  await page.locator('[data-practice-grid] button').first().click();
  await expect(page.locator('[data-question-mount] fieldset')).toHaveClass(/correct/);
  await expect(page.locator('[data-practice-flag]')).toHaveAttribute('aria-pressed', 'true');
});

test('Exam mode grades at submission and stores sanitized question outcomes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await openPractice(page);
  await page.locator('input[name="practiceMode"][value="exam"]').check();
  await startPractice(page);
  for (let index = 0; index < 10; index += 1) {
    await answerCurrentCorrectly(page);
    if (index < 9) await page.locator('[data-practice-next]').click();
  }
  await page.locator('[data-submit-practice]').click();
  await expect(page.locator('#practiceResults')).toBeVisible();
  await expect(page.locator('[data-practice-result-percent]')).toHaveText('100%');
  const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')).targetedPracticeAttempts[0]);
  expect(attempt.questionResults).toHaveLength(10);
  expect(attempt.questionResults[0]).toHaveProperty('selectedOptionId');
  expect(JSON.stringify(attempt)).not.toContain('questionText');
  expect(JSON.stringify(attempt)).not.toContain('correctAnswer');
  expect(attempt.selectedDomains).toHaveLength(5);
});

test('Weaker-domain mode uses the two lowest stored exam-domain results', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({
      schemaVersion: 2, recordId: 'test-progress', createdAt: now, updatedAt: now,
      owner: { kind: 'anonymous', anonymousId: 'anon-test', accountId: null },
      entitlement: { tier: 'public', status: 'preview', source: 'test', updatedAt: now },
      modules: {}, studyTasks: {}, quizAttempts: [],
      mockExamAttempts: [{
        id: 'mock-test', completedAt: now, percent: 70,
        domains: [
          { domain: 'Fixation', correct: 9, total: 10, percent: 90 },
          { domain: 'Processing', correct: 4, total: 10, percent: 40 },
          { domain: 'Embedding/Microtomy', correct: 6, total: 10, percent: 60 },
          { domain: 'Staining', correct: 8, total: 10, percent: 80 },
          { domain: 'Laboratory Operations', correct: 7, total: 10, percent: 70 }
        ], questionResults: []
      }],
      targetedPracticeAttempts: [], activeSessions: {}, activity: [],
      migration: { legacyVersion: 1, completedAt: now }
    }));
  });
  await openPractice(page);
  await page.locator('input[name="sourceMode"][value="weak"]').check();
  await expect(page.locator('[data-pool-count]')).toContainText('Processing and Embedding/Microtomy');
  await startPractice(page);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')).activeSessions['targeted-practice']);
  expect(session.selectedDomains).toEqual(['Processing', 'Embedding/Microtomy']);
});

test('Missed and flagged modes use exact saved question IDs', async ({ page }) => {
  const ids = Array.from({ length: 10 }, (_, index) => `fixation-v3-${index + 1}`);
  await page.addInitScript((questionIds) => {
    const now = new Date().toISOString();
    const questionResults = questionIds.map((questionId, index) => ({
      questionId, sourceQuestionId: questionId, moduleId: 'fixation-v3', domain: 'Fixation',
      selectedOptionId: 'x', correct: index % 2 === 0, flagged: true
    }));
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({
      schemaVersion: 2, recordId: 'test-progress', createdAt: now, updatedAt: now,
      owner: { kind: 'anonymous', anonymousId: 'anon-test', accountId: null },
      entitlement: { tier: 'public', status: 'preview', source: 'test', updatedAt: now },
      modules: {}, studyTasks: {}, quizAttempts: [],
      mockExamAttempts: [{ id: 'mock-test', completedAt: now, percent: 50, domains: [], questionResults }],
      targetedPracticeAttempts: [], activeSessions: {}, activity: [],
      migration: { legacyVersion: 1, completedAt: now }
    }));
  }, ids);

  await openPractice(page);
  await page.locator('input[name="sourceMode"][value="flagged"]').check();
  await selectOnlyDomain(page, 'Fixation');
  await expect(page.locator('[data-pool-count]')).toContainText('10 matching questions');
  await startPractice(page);
  const selected = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')).activeSessions['targeted-practice'].questionIds);
  expect([...selected].sort()).toEqual([...ids].sort());
});

test('mobile Targeted Practice has no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await openPractice(page);
  await startPractice(page);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
