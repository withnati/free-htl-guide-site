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

for (const [lesson, route, protectedRoute] of [
  ['Processing and Decalcification', '/modules/processing-guide-v3.html', /premium\/processing-proof\.html$/],
  ['Embedding and Microtomy', '/modules/embedding-guide-v3.html', /premium\/embedding-microtomy\.html$/]
]) {
  test(`${lesson} preview tells Premium learners the complete secure lesson is available`, async ({ page }) => {
    await mockPremiumSupabase(page);
    await page.goto(route);

    await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
    await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
    await expect(page.locator('[data-premium-preview-label]')).toHaveText('Premium access confirmed');
    await expect(page.locator('[data-premium-preview-message]')).toHaveText(`Your account includes ${lesson}.`);
    await expect(page.locator('[data-premium-preview-detail]')).toContainText(
      'Open the complete securely delivered lesson below.'
    );
    await expect(page.locator('[data-premium-preview-context]')).toContainText('Premium access is confirmed.');
    await expect(page.locator('[data-premium-preview-context]')).not.toContainText('Sign in');
    await expect(page.getByRole('link', { name: 'Open secure lesson' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open secure lesson' })).toHaveAttribute('href', protectedRoute);
    await expect(page.getByText(/complete lesson will be added here/i)).toHaveCount(0);
    await expect(page.getByText(/lesson preview below/i)).toHaveCount(0);
    await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
    await expect(page.locator('[data-expl]')).toHaveCount(0);
  });
}

test('upcoming Premium lesson keeps release-in-progress language for an entitled learner', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/modules/staining-he-guide.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.locator('[data-premium-preview-detail]')).toContainText('being prepared for secure release');
  await expect(page.locator('[data-premium-preview-context]')).toContainText(
    'will appear in your library when its secure release is completed'
  );
  await expect(page.getByRole('link', { name: 'Open secure lesson' })).toHaveCount(0);
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
});

test('signed-out released preview preserves the public preview and plan-comparison path', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/modules/processing-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'signed-out');
  await expect(page.locator('[data-premium-preview-label]')).toHaveText('Premium preview');
  await expect(page.locator('[data-premium-preview-message]')).toHaveText(
    'Processing and Decalcification is included with Premium.'
  );
  await expect(page.locator('[data-premium-preview-context]')).toContainText('Sign in to let this page confirm');
  await expect(page.getByRole('link', { name: 'Compare Premium plans' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open secure lesson' })).toBeHidden();
});
