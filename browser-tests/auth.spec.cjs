const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function mockSupabase(page, options = {}) {
  const calls = [];
  await page.exposeFunction('__recordSupabaseCall', (call) => {
    calls.push(call);
  });
  const script = `
    window.supabase = {
      createClient() {
        const session = ${JSON.stringify(options.session || null)};
        const user = ${JSON.stringify(options.user || null)};
        const ok = (data = {}) => Promise.resolve({ data, error: null });
        const auth = {
          getSession: () => ok({ session }),
          getUser: () => ok({ user }),
          signUp: async (payload) => { await window.__recordSupabaseCall(['signUp', payload]); return ok({ user: { id: 'user-a' }, session: null }); },
          signInWithPassword: async (payload) => { await window.__recordSupabaseCall(['signIn', payload]); return ok({ user: { id: 'user-a' }, session: { access_token: 'test' } }); },
          resetPasswordForEmail: async (email, payload) => { await window.__recordSupabaseCall(['reset', email, payload]); return ok({}); },
          resend: async (payload) => { await window.__recordSupabaseCall(['resend', payload]); return ok({}); },
          updateUser: async (payload) => { await window.__recordSupabaseCall(['updateUser', payload]); return ok({ user: user || { id: 'user-a', email: 'learner@example.test', user_metadata: payload.data || {} } }); },
          signOut: async () => { await window.__recordSupabaseCall(['signOut']); return ok({}); },
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
        };
        return {
          auth,
          from: () => ({ update: () => ({ eq: () => ok({}) }) })
        };
      }
    };
  `;
  await page.route(sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
  return calls;
}

test('account signup sends approved redirect and moves to verification', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const calls = await mockSupabase(page);
  await page.goto('/account/sign-up.html?next=%2Fmy-progress.html');
  await page.getByLabel('Display name').fill('Learner A');
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SecurePass1');
  await page.getByLabel('Confirm password').fill('SecurePass1');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page).toHaveURL(/\/account\/verify-email\.html/);
  expect(calls[0][0]).toBe('signUp');
  expect(calls[0][1].options.emailRedirectTo).toContain('/account/auth-callback.html');
});

test('sign in rejects an external next destination', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page);
  await page.goto('/account/sign-in.html?next=https%3A%2F%2Fevil.example%2Fsteal');
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password').fill('SecurePass1');
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page).toHaveURL(/\/my-progress\.html$/);
});

test('account settings require a session and render the signed-in identity', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await mockSupabase(page, {
    session: { access_token: 'test' },
    user: { id: 'user-a', email: 'learner@example.test', user_metadata: { display_name: 'Learner A' } }
  });
  await page.goto('/account/settings.html');
  await expect(page.locator('[data-account-email]')).toHaveText('learner@example.test');
  await expect(page.getByLabel('Display name')).toHaveValue('Learner A');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
