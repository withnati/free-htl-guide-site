const { test, expect } = require('@playwright/test');

async function waitForAnalytics(page) {
  await expect.poll(
    () => page.evaluate(() => Boolean(window.FreeHTLAnalytics?.configured)),
    { message: 'analytics configuration should load' }
  ).toBe(true);
}

test('pricing cadence selection records a privacy-safe Premium funnel event', async ({ page }) => {
  await page.goto('/pricing.html?analytics_debug=1');
  await waitForAnalytics(page);

  await page.getByRole('button', { name: 'Annual' }).click();

  const event = await page.evaluate(() =>
    window.FreeHTLAnalytics.debugEvents
      .filter((entry) => entry.eventName === 'premium_plan_select')
      .at(-1)
  );

  expect(event).toBeTruthy();
  expect(event.payload.plan_code).toBe('premium_annual');
  expect(event.payload.billing_cadence).toBe('annual');
  expect(event.payload).not.toHaveProperty('email');
  expect(event.payload).not.toHaveProperty('user_id');
});

test('Premium funnel analytics scrub non-allowlisted and prohibited fields', async ({ page }) => {
  await page.goto('/pricing.html?analytics_debug=1');
  await waitForAnalytics(page);

  await page.evaluate(() => {
    window.FreeHTLAnalytics.track('premium_checkout_error', {
      plan_code: 'premium_monthly',
      billing_cadence: 'monthly',
      error_type: 'checkout_unavailable',
      email: 'must-not-leave-browser@example.com',
      user_id: 'must-not-leave-browser',
      payment_card: 'must-not-leave-browser'
    });
  });

  const event = await page.evaluate(() =>
    window.FreeHTLAnalytics.debugEvents
      .filter((entry) => entry.eventName === 'premium_checkout_error')
      .at(-1)
  );

  expect(event).toBeTruthy();
  expect(event.payload.plan_code).toBe('premium_monthly');
  expect(event.payload.billing_cadence).toBe('monthly');
  expect(event.payload.error_type).toBe('checkout_unavailable');
  expect(event.payload).not.toHaveProperty('email');
  expect(event.payload).not.toHaveProperty('user_id');
  expect(event.payload).not.toHaveProperty('payment_card');
});
