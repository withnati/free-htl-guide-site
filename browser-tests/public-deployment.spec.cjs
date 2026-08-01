const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
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

test('public homepage leads with HT and HTL exam preparation', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/HT and HTL Exam Preparation/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prepare confidently for the HT or HTL exam');
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' }).first()).toHaveAttribute(
    'href',
    /modules\/fixation-guide-v3\.html$/
  );
  await expect(page.getByText('Free', { exact: true })).toBeVisible();
  await expect(page.getByText('Premium', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Create free account/i }).first()).toBeVisible();
  await expect(page.getByText('Premium enrollment is not open yet.')).toBeVisible();
  await expect(page.locator('.resource-card')).toHaveCount(6);

  const publicDownloads = await page.locator('.resource-card').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(publicDownloads).not.toContain('assets/Processing_Schedules_Templates.pdf');
  expect(publicDownloads).not.toContain('assets/Decalc_Endpoint_SOP.pdf');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('server-controlled entitlement');
  expect(body).not.toContain('question payload');
  await expectNoHorizontalOverflow(page);
});

test('complete public Fixation lesson remains usable in the generated deployment', async ({ page }) => {
  await page.goto('/modules/fixation-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'fixation-v3');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fixation');
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(10);
  await expect(page.getByRole('link', { name: 'Download resources' })).toHaveAttribute(
    'href',
    /assets\/all-fixation-downloads\.zip$/
  );
  await expectNoHorizontalOverflow(page);
});

test('premium lesson route contains a learner-facing preview without lesson or quiz payload', async ({ page }) => {
  await page.goto('/modules/processing-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Processing and Decalcification');
  await expect(page.getByText('Included with Premium', { exact: true })).toBeVisible();
  await expect(page.getByText('Premium enrollment is not open yet.')).toBeVisible();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expect(page.locator('script[src*="mock-exam"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('protected-delivery proof');
  expect(body).not.toContain('authorized delivery');
  await expectNoHorizontalOverflow(page);
});

test('public mock-exam route previews exam value without shipping the runtime or question bank', async ({ page }) => {
  await page.goto('/mock-exam.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('50-question HT/HTL mock exam');
  await expect(page.getByText('Included with Premium', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-start-exam]')).toHaveCount(0);
  await expect(page.locator('script[src*="mock-exam"]')).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Loading question bank');
  expect(body).toContain('domain results');
  await expectNoHorizontalOverflow(page);
});

test('generated account route remains noindex and explains the study benefit', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/account/sign-in.html');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to continue studying');
  await expect(page.getByText(/saved progress, recent activity/i)).toBeVisible();
  await expect(page.locator('form[data-sign-in-form]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('generated Premium lesson shell gives a clear signed-out action', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in required');
  await expect(page.locator('[data-premium-message]')).toHaveText('Sign in to continue learning.');
  await expect(page.locator('[data-premium-sign-in]')).toHaveText('Sign in to continue');
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});
