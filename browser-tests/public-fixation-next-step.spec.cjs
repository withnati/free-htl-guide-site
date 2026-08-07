const { test, expect } = require('@playwright/test');

test('Fixation completion reveals a clear next study step without interrupting the lesson', async ({ page }) => {
  await page.goto('/modules/fixation-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-fixation-runtime', 'active');
  await expect(page.locator('[data-fixation-next-step]')).toHaveCount(0);

  const answers = await page.evaluate(async () => {
    const response = await fetch('/data/fixation-runtime-bank.json', { cache: 'no-store' });
    const bank = await response.json();
    return Object.fromEntries(
      bank.map((question) => [
        `${question.id}:${question.version}`,
        question.correct_option_id
      ])
    );
  });

  const fields = page.locator('#fixQuiz fieldset[data-question-id]');
  await expect(fields).toHaveCount(10);
  for (let index = 0; index < 10; index += 1) {
    const field = fields.nth(index);
    const questionId = await field.getAttribute('data-question-id');
    const questionVersion = await field.getAttribute('data-question-version');
    const correctOptionId = answers[`${questionId}:${questionVersion}`];
    expect(correctOptionId).toBeTruthy();
    await field.locator(`input[value="${correctOptionId}"]`).check();
  }

  await page.locator('[data-grade="fixQuiz"]').click();

  await expect(page.locator('#quizResult')).toContainText('Study target met');
  const panel = page.locator('[data-fixation-next-step]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Fixation target met — choose your next step' })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Continue to Processing' })).toHaveAttribute(
    'href',
    /modules\/processing-guide-v3\.html$/
  );
  await expect(panel.getByRole('link', { name: 'Open My Progress' })).toHaveAttribute(
    'href',
    /my-progress\.html$/
  );
  await expect(panel).toContainText('Processing and Decalcification is a Premium lesson');

  // The handoff must not reintroduce embedded answer-key markup into the generated public page.
  await expect(page.locator('#fixQuiz fieldset[data-correct]')).toHaveCount(0);

  await page.locator('[data-retry="fixQuiz"]').click();
  await expect(panel).toBeHidden();
});
