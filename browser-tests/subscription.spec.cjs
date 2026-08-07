const { test, expect } = require('@playwright/test');
const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function mockBillingSupabase(page, options = {}) {
  const calls = [];
  await page.exposeFunction('__recordBillingCall', (call) => calls.push(call));
  const script = `
    window.supabase = {
      createClient() {
        const session = ${JSON.stringify(options.session || null)};
        const status = ${JSON.stringify(options.status || {
          state: 'free', premiumAccess: false, billingCadence: null,
          currentPeriodEnd: null, graceUntil: null, cancelAtPeriodEnd: false,
          canManageBilling: false
        })};
        return {
          auth: {
            getSession: async () => ({ data: { session }, error: null }),
            getUser: async () => ({ data: { user: session?.user || null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
          },
          functions: {
            invoke: async (name, payload) => {
              await window.__recordBillingCall([name, payload]);
              if (name === 'subscription-status') return { data: status, error: null };
              if (name === 'create-checkout-session') return { data: { checkoutUrl: 'https://invalid.example/checkout' }, error: null };
              return { data: { portalUrl: 'https://invalid.example/portal' }, error: null };
            }
          }
        };
      }
    };
  `;
  await page.route(sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
  return calls;
}

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
  await expect(page.getByText('$9.99', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Annual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Annual', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$99.99', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly and annual plans include the same features' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('signed-out upgrade requires account sign-in and grants no access', async ({ page }) => {
  await mockBillingSupabase(page);
  await page.goto('/pricing.html');
  await page.getByRole('button', { name: 'Choose monthly Premium' }).click();
  await expect(page).toHaveURL(/\/account\/sign-in\.html\?next=/);
  await expect(page.locator('input[type="text"], input[type="number"], input[autocomplete="cc-number"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-premium', 'true');
});

test('checkout submits only an allowlisted plan to the trusted function', async ({ page }) => {
  const calls = await mockBillingSupabase(page, { session: { access_token: 'test', user: { id: 'user-a' } } });
  await page.goto('/pricing.html');
  await page.getByRole('button', { name: 'Annual', exact: true }).click();
  await page.getByRole('button', { name: 'Choose annual Premium' }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0][0]).toBe('create-checkout-session');
  expect(calls[0][1].body).toEqual({ plan: 'premium_annual' });
  await expect(page.getByText('We could not open checkout. Please try again in a moment.')).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-premium', 'true');
});

test('subscription account renders trusted status and opens billing portal', async ({ page }) => {
  const calls = await mockBillingSupabase(page, {
    session: { access_token: 'test', user: { id: 'user-a' } },
    status: {
      state: 'active', premiumAccess: true, billingCadence: 'annual',
      currentPeriodEnd: '2027-08-03T00:00:00.000Z', graceUntil: null,
      cancelAtPeriodEnd: false, canManageBilling: true
    }
  });
  await page.goto('/account/subscription.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subscription');
  await expect(page.getByText('Premium active', { exact: true })).toBeVisible();
  await expect(page.getByText(/learning available now and the verified release status/)).toBeVisible();
  await expect(page.locator('[data-billing-cadence]')).toHaveText('Annual');
  await page.getByRole('button', { name: 'Manage billing' }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls.map((call) => call[0])).toEqual(['subscription-status', 'create-billing-portal-session']);
  await expectNoHorizontalOverflow(page);
});

test('ended Premium account retains history without promising unreleased tools', async ({ page }) => {
  await mockBillingSupabase(page, {
    session: { access_token: 'test', user: { id: 'user-a' } },
    status: {
      state: 'expired', premiumAccess: false, billingCadence: null,
      currentPeriodEnd: '2026-08-01T00:00:00.000Z', graceUntil: null,
      cancelAtPeriodEnd: false, canManageBilling: false
    }
  });
  await page.goto('/account/subscription.html');

  await expect(page.getByText('Premium ended', { exact: true })).toBeVisible();
  await expect(page.getByText(/currently released learning experiences/)).toBeVisible();
  await expect(page.getByText(/full course and practice tools/)).toHaveCount(0);
});
