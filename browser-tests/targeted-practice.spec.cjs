const { test, expect } = require('@playwright/test');

async function declineAnalytics(page) {
  const button = page.getByRole('button', { name: 'Decline analytics' });
  if (await button.count()) await button.click();
}

async function openPractice(page) {
  await page.goto('/targeted-practice.html');
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

test('targeted practice is a premium-designated noindex development preview', async ({ page }) => {
  await openPractice(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-targeted-bank-total]')).toHaveText('150');
  await expect(page.locator('[data-pool-count]')).toContainText('150 matching questions');
  await expect(page.getByText('Premium-designated preview.')).toBeVisible();
});

test('study mode gives immediate feedback and saves a resumable account-ready session', async ({ page }) => {
  await openPractice(page);
  await startPractice(page);
  await answerCurrentCorrectly(page);
  await page.locator('[data-check-answer]').click();
  await expect(page.locator('[data-question-mount] fieldset')).toHaveClass(/correct/);
  await expect(page.locator('[data-question-mount] .explanation')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('free-htl-progress-v1'));
    return record?.activeSessions?.['targeted-practice']?.checked?.length;
  })).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')));
  expect(saved.activeSessions['targeted-practice'].questionIds).toHaveLength(10);
  expect(saved.activeSessions['targeted-practice']).not.toHaveProperty('questions');
});

test('a saved set resumes with position, answers, flags, and feedback state', async ({ page }) => {
  await openPractice(page);
  await startPractice(page);
  await answerCurrentCorrectly(page);
  await page.locator('[data-check-answer]').click();
  await page.locator('[data-practice-flag]').click();
  await page.locator('[data-practice-next]').click();
  await page.reload();
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-targeted-practice-ready', 'true');
  await expect(page.locator('[data-resume-practice]')).toBeVisible();
  await page.locator('[data-resume-practice]').click();
  await expect(page.locator('[data-practice-position]')).toHaveText('2 of 10');
  await page.locator('[data-practice-grid] button').first().click();
  await expect(page.locator('[data-question-mount] fieldset')).toHaveClass(/correct/);
  await expect(page.locator('[data-practice-flag]')).toHaveAttribute('aria-pressed', 'true');
});

test('exam mode grades at submission and stores sanitized question-level outcomes', async ({ page }, testInfo) => {
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
  await expect.poll(() => page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('free-htl-progress-v1'));
    return record?.targetedPracticeAttempts?.[0]?.percent;
  })).toBe(100);
  const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')).targetedPracticeAttempts[0]);
  expect(attempt.questionResults).toHaveLength(10);
  expect(attempt.questionResults[0]).toHaveProperty('selectedOptionId');
  expect(JSON.stringify(attempt)).not.toContain('questionText');
  expect(JSON.stringify(attempt)).not.toContain('correctAnswer');
  expect(attempt.selectedDomains).toHaveLength(5);
});

test('weak-domain mode uses the two lowest stored domain results', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({
      schemaVersion: 2,
      recordId: 'test-progress',
      createdAt: now,
      updatedAt: now,
      owner: { kind: 'anonymous', anonymousId: 'anon-test', accountId: null },
      entitlement: { tier: 'public', status: 'preview', source: 'test', updatedAt: now },
      modules: {},
      studyTasks: {},
      quizAttempts: [],
      mockExamAttempts: [{
        id: 'mock-test', completedAt: now, percent: 70,
        domains: [
          { domain: 'Fixation', percent: 90 },
          { domain: 'Processing', percent: 40 },
          { domain: 'Embedding/Microtomy', percent: 55 },
          { domain: 'Staining', percent: 80 },
          { domain: 'Laboratory Operations', percent: 75 }
        ],
        questionResults: []
      }],
      targetedPracticeAttempts: [],
      activeSessions: {},
      activity: [],
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

test('previously missed mode selects only stored missed question IDs', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const missed = Array.from({ length: 10 }, (_, index) => ({
      questionId: `fixation-v3-${index + 1}`,
      sourceQuestionId: `fixation-v3-${index + 1}`,
      moduleId: 'fixation-v3',
      domain: 'Fixation',
      selectedOptionId: 'x',
      correct: false,
      flagged: false
    }));
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({
      schemaVersion: 2,
      recordId: 'test-progress',
      createdAt: now,
      updatedAt: now,
      owner: { kind: 'anonymous', anonymousId: 'anon-test', accountId: null },
      entitlement: { tier: 'public', status: 'preview', source: 'test', updatedAt: now },
      modules: {},
      studyTasks: {},
      quizAttempts: [],
      mockExamAttempts: [{ id: 'mock-test', completedAt: now, percent: 0, domains: [], questionResults: missed }],
      targetedPracticeAttempts: [],
      activeSessions: {},
      activity: [],
      migration: { legacyVersion: 1, completedAt: now }
    }));
  });
  await openPractice(page);
  await page.locator('input[name="sourceMode"][value="missed"]').check();
  await page.locator('input[name="domains"]').evaluateAll((items) => items.forEach((item) => {
    item.checked = item.value === 'Fixation';
    item.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  await expect(page.locator('[data-pool-count]')).toContainText('10 matching questions');
  await startPractice(page);
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')).activeSessions['targeted-practice'].questionIds);
  expect(ids.every((id) => id.startsWith('fixation-v3-'))).toBeTruthy();
});

test('mobile targeted practice has no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await openPractice(page);
  await startPractice(page);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
