const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test('pricing page offers one Premium product with monthly and annual billing', async ({ page }) => {
  await page.goto('/pricing.html');
  await expect(page).toHaveTitle(/HT and HTL Exam Preparation Pricing/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Start free');
  await expect(page.getByRole('button', { name: 'Monthly', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$19.99', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Annual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Annual', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$191.99', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly and annual plans include the same features' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('upgrade placeholder collects no payment and grants no access', async ({ page }) => {
  await page.goto('/pricing.html');
  await page.getByRole('button', { name: 'Choose monthly Premium' }).click();
  await expect(page.getByText('Premium enrollment is not open yet.', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="text"], input[type="number"], input[autocomplete="cc-number"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-premium', 'true');
});

test('subscription account page explains all lifecycle states safely', async ({ page }) => {
  await page.goto('/account/subscription.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subscription');
  await expect(page.getByText('Free account', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Payment issue' }).click();
  await expect(page.getByRole('heading', { name: 'Update billing to keep Premium active' })).toBeVisible();

  await page.getByRole('button', { name: 'Expired' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is now on the free plan' })).toBeVisible();
  await expect(page.getByText(/do not change your account or grant access/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
