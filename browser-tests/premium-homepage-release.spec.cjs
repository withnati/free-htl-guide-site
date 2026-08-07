const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function mockPremiumSupabase(page) {
  const status = {
    state: 'active',
    premiumAccess: true,
    billingCadence: 'annual',
    currentPeriodEnd: '2027-08-03T00:00:00.000Z',
    graceUntil: null,
    cancelAtPeriodEnd: false,
    canManageBilling: true
  };

  await page.route(sdkUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.supabase = {
        createClient() {
          const session = { access_token: 'test', user: { id: 'premium-user' } };
          return {
            auth: {
              getSession: async () => ({ data: { session }, error: null }),
              getUser: async () => ({ data: { user: session.user }, error: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
            },
            functions: {
              invoke: async (name) => name === 'subscription-status'
                ? ({ data: ${JSON.stringify(status)}, error: null })
                : ({ data: {}, error: null })
            },
            from() {
              const query = {
                select: () => query,
                eq: () => query,
                limit: () => query,
                then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
              };
              return query;
            }
          };
        }
      };
    `
  }));
}

async function mockSignedOutSupabase(page) {
  await page.route(sdkUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.supabase = {
        createClient() {
          const ok = (data = {}) => Promise.resolve({ data, error: null });
          return {
            auth: {
              getSession: () => ok({ session: null }),
              getUser: () => ok({ user: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
              signOut: () => ok({})
            },
            from: () => ({ update: () => ({ eq: () => ok({}) }) }),
            functions: { invoke: () => ok({}) }
          };
        }
      };
    `
  }));
}

async function expectReleaseCards(page, availableLabel) {
  const available = page.locator('[data-premium-route-link][data-premium-release="available"]');
  const upcoming = page.locator('[data-premium-route-link][data-premium-release="upcoming"]');

  await expect(available).toHaveCount(2);
  await expect(upcoming).toHaveCount(4);

  for (const link of await available.all()) {
    await expect(link).toHaveText(availableLabel);
    await expect(link.locator('xpath=ancestor::article[1]').locator('.tag-row .chip').first()).toHaveText('Secure lesson available');
  }
  for (const link of await upcoming.all()) {
    await expect(link).toHaveText('View release status');
    await expect(link.locator('xpath=ancestor::article[1]').locator('.tag-row .chip').first()).toHaveText('Secure release in progress');
  }
}

test('Premium homepage distinguishes released lessons from upcoming releases', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expectReleaseCards(page, 'Open lesson');
  await expect(page.getByText(/securely delivered Processing and Embedding lessons/)).toBeVisible();
  await expect(page.getByText(/New protected releases will appear in your library after verification/)).toBeVisible();
});

test('signed-out homepage does not present unreleased Premium lessons as open', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'signed-out');
  await expectReleaseCards(page, 'View lesson');
});
