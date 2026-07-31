const { test, expect } = require('@playwright/test');

async function declineAnalytics(page) {
  const button = page.getByRole('button', { name: 'Decline analytics' });
  if (await button.count()) await button.click();
}

async function openReadyExam(page) {
  await page.goto('/mock-exam.html');
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-mock-exam-loaded', 'true');
  await expect(page.locator('[data-exam-status]')).toContainText('150 reviewed questions ready');
}

test('mock exam loads the controlled blueprint and complete expanded bank', async ({ page }) => {
  await openReadyExam(page);
  await expect(page.locator('[data-blueprint-body] tr')).toHaveCount(5);
  await expect(page.locator('[data-bank-total]')).toHaveText('150');
  await expect(page.locator('[data-start-exam]')).toBeEnabled();
  const counts = await page.evaluate(() => {
    const bank = window.FreeHTLMockExam.getBank();
    return {
      total: bank.questions.length,
      module: bank.moduleQuestionCount,
      variants: bank.variantQuestionCount,
      inherited: bank.questions.filter((question) => question.variantOf).length
    };
  });
  expect(counts).toEqual({ total: 150, module: 70, variants: 80, inherited: 80 });
});

test('untimed attempt samples variants and saves answer and flag state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.addInitScript(() => { Math.random = () => 0; });
  await openReadyExam(page);
  await page.locator('input[name="examMode"][value="untimed"]').check();
  await page.locator('[data-start-exam]').click();
  await expect(page.locator('#exam')).toBeVisible();
  await expect(page.locator('#htl-mock-50 fieldset')).toHaveCount(50);
  await expect(page.locator('[data-question-grid] button')).toHaveCount(50);
  const includesVariant = await page.evaluate(() => window.FreeHTLMockExam.getAttempt().questions.some((question) => Boolean(question.variantOf)));
  expect(includesVariant).toBe(true);
  await page.locator('#htl-mock-50 fieldset:not([hidden]) input').first().check();
  await page.locator('[data-toggle-flag]').click();
  await expect(page.locator('[data-answered-count]')).toHaveText('1');
  await expect(page.locator('[data-flagged-count]')).toHaveText('1');

  await page.reload();
  await declineAnalytics(page);
  await expect(page.locator('body')).toHaveAttribute('data-mock-exam-loaded', 'true');
  await expect(page.locator('[data-resume-exam]')).toBeVisible();
  await page.locator('[data-resume-exam]').click();
  await expect(page.locator('#htl-mock-50 fieldset:not([hidden]) input:checked')).toHaveCount(1);
  await expect(page.locator('[data-toggle-flag]')).toHaveAttribute('aria-pressed', 'true');
});

test('a variant inherits its source choices and grading key', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.addInitScript(() => { Math.random = () => 0; });
  await openReadyExam(page);
  await page.locator('input[name="examMode"][value="untimed"]').check();
  await page.locator('[data-start-exam]').click();

  const variantIndex = await page.evaluate(() => window.FreeHTLMockExam.getAttempt().questions.findIndex((question) => Boolean(question.variantOf)));
  expect(variantIndex).toBeGreaterThanOrEqual(0);
  await page.locator(`[data-question-index="${variantIndex}"]`).click();
  const current = page.locator('#htl-mock-50 fieldset:not([hidden])');
  await expect(current.locator('label')).toHaveCount(4);
  const correct = await current.getAttribute('data-correct');
  await current.locator(`input[value="${correct}"]`).check();
  await page.locator('[data-submit-exam]').click();
  await page.locator('[data-submit-anyway]').click();
  await expect(page.locator('[data-result-score]')).toHaveText('1/50');
});

test('submission warns about unanswered items and produces domain results and history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await openReadyExam(page);
  await page.locator('input[name="examMode"][value="untimed"]').check();
  await page.locator('[data-start-exam]').click();
  await page.locator('#htl-mock-50 fieldset:not([hidden]) input').first().check();
  await page.locator('[data-submit-exam]').click();
  await expect(page.locator('[data-submit-warning]')).toBeVisible();
  await expect(page.locator('[data-unanswered-warning]')).toHaveText('49');
  await page.locator('[data-submit-anyway]').click();
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('[data-domain-results] .domain-result')).toHaveCount(5);
  await expect(page.locator('[data-result-score]')).toContainText('/50');
  await expect(page.locator('[data-history-body] tr')).toHaveCount(1);
  await expect(page.locator('[data-exam-review] .review-item')).not.toHaveCount(0);
});

test('mobile mock exam navigation remains usable without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await openReadyExam(page);
  await page.locator('input[name="examMode"][value="untimed"]').check();
  await page.locator('[data-start-exam]').click();
  await expect(page.locator('[data-question-grid] button')).toHaveCount(50);
  await page.locator('[data-next-question]').click();
  await expect(page.locator('[data-question-position]')).toHaveText('2 of 50');
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
