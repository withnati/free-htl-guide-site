const { test, expect } = require('@playwright/test');

async function declineAnalytics(page) {
  const button = page.getByRole('button', { name: 'Decline analytics' });
  if (await button.count()) await button.click();
}

async function openDashboard(page) {
  await page.goto('/my-progress.html');
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
}

test('dashboard is private, learner-centered, and labels the access model', async ({ page }) => {
  await openDashboard(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-account-status]')).toHaveText('Using this device');
  await expect(page.locator('[data-storage-status]')).toHaveText('On this device');
  await expect(page.locator('[data-module-progress] .module-row')).toHaveCount(7);
  await expect(page.locator('[data-module-progress] .access-public')).toHaveCount(1);
  await expect(page.locator('[data-module-progress] .access-premium')).toHaveCount(6);
  await expect(page.locator('[data-summary-modules]')).toHaveText('0/7');
});

test('legacy local progress migrates into the normalized learner record', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('last:fixation-v3', 'preanalytics');
    localStorage.setItem('check:fixation-v3:o1', '1');
    localStorage.setItem('quiz:fixation-v3', '90');
    localStorage.setItem('best:fixation-v3', '90');
    localStorage.setItem('free-htl-mock-history-v1', JSON.stringify([{
      completedAt: Date.now(), mode: 'untimed', score: 38, total: 50, percent: 76, timeUsedMs: 2400000,
      domains: [{ domain: 'Fixation', correct: 8, total: 10, percent: 80 }]
    }]));
  });
  await openDashboard(page);
  await expect(page.locator('[data-summary-modules]')).toHaveText('1/7');
  await expect(page.locator('[data-summary-quiz]')).toHaveText('90%');
  await expect(page.locator('[data-summary-mock]')).toHaveText('76%');
  await expect(page.locator('[data-summary-tasks]')).toHaveText('1');
  await expect(page.locator('[data-domain-progress]')).toContainText('Fixation');
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')));
  expect(record.migration.legacyVersion).toBe(1);
  expect(record.owner.kind).toBe('anonymous');
});

test('module quiz events write through the shared progress service', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/modules/fixation-guide-v3.html');
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-progress-service-ready', 'true');
  await page.evaluate(() => {
    document.querySelectorAll('#fixQuiz fieldset[data-correct]').forEach((field) => {
      field.querySelector(`input[value="${field.dataset.correct}"]`).checked = true;
    });
  });
  await page.locator('[data-grade="fixQuiz"]').click();
  await expect.poll(() => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('free-htl-progress-v1'));
    return value?.quizAttempts?.[0]?.percent;
  })).toBe(100);
  await page.goto('/my-progress.html');
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
  await expect(page.locator('[data-module-progress] .module-row').first()).toContainText('Quiz target met');
  await expect(page.locator('[data-module-progress] .module-row').first()).toContainText('100%');
});

test('learner export excludes private notes and answer keys', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('note:fixation-v3:main', 'private-note-value');
  });
  await openDashboard(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('htl:mock-completed', {
    detail: {
      attemptId: 'attempt-test', examId: 'free-htl-mock-50', completedAt: new Date().toISOString(),
      mode: 'untimed', score: 1, total: 50, percent: 2, timeUsedMs: 1000,
      domains: [{ domain: 'Fixation', correct: 1, total: 10, percent: 10 }],
      questionResults: [{ questionId: 'fixation-v3-q1', sourceQuestionId: 'fixation-v3-q1', moduleId: 'fixation-v3', domain: 'Fixation', selectedOptionId: 'B', correct: true, flagged: false }]
    }
  })));
  await expect(page.locator('[data-domain-progress]')).toContainText('Fixation');
  const exported = await page.evaluate(async () => JSON.parse(await window.FreeHTLProgress.exportProgress()));
  const serialized = JSON.stringify(exported);
  expect(serialized).not.toContain('private-note-value');
  expect(serialized).not.toContain('questionText');
  expect(serialized).not.toContain('correctAnswer');
  expect(exported.progress.mockExamAttempts[0].questionResults[0].selectedOptionId).toBe('B');
});

test('reset removes learning progress but preserves notes and privacy choices', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('note:fixation-v3:main', 'keep-this-note');
    localStorage.setItem('free-htl-analytics-consent', JSON.stringify({ status: 'denied', version: '2026-07-31' }));
    localStorage.setItem('quiz:fixation-v3', '80');
  });
  await openDashboard(page);
  await page.locator('[data-reset-progress]').click();
  await page.locator('[data-confirm-reset]').click();
  await expect(page.locator('[data-summary-modules]')).toHaveText('0/7');
  const preserved = await page.evaluate(() => ({
    note: localStorage.getItem('note:fixation-v3:main'),
    consent: localStorage.getItem('free-htl-analytics-consent'),
    legacyQuiz: localStorage.getItem('quiz:fixation-v3')
  }));
  expect(preserved.note).toBe('keep-this-note');
  expect(preserved.consent).toContain('denied');
  expect(preserved.legacyQuiz).toBeNull();
});

test('mobile dashboard has no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await openDashboard(page);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
