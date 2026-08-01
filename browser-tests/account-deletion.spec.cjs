const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function mockSupabase(page) {
  const calls = [];
  await page.exposeFunction('__recordDeletionCall', (call) => calls.push(call));
  const script = `
    (() => {
      const session = {
        access_token: 'verified-user-token',
        user: {
          id: 'user-a',
          email: 'learner@example.test',
          user_metadata: { display_name: 'Learner A' }
        }
      };
      const ok = (data = {}) => Promise.resolve({ data, error: null });
      window.supabase = {
        createClient() {
          return {
            auth: {
              getSession: () => ok({ session }),
              getUser: () => ok({ user: session.user }),
              updateUser: () => ok({ user: session.user }),
              signOut: async (options) => { await window.__recordDeletionCall(['signOut', options]); return ok({}); },
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
            },
            functions: {
              invoke: async (name, options) => {
                await window.__recordDeletionCall(['invoke', name, options]);
                return { data: { deleted: true }, error: null };
              }
            },
            from: () => ({ update: () => ({ eq: () => ok({}) }) })
          };
        }
      };
    })();
  `;
  await page.route(sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
  return calls;
}

test('account deletion requires exact confirmation and clears account progress state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const calls = await mockSupabase(page);
  await page.addInitScript(() => {
    localStorage.setItem('free-htl-cloud-sync-v1', JSON.stringify({ userId: 'user-a', mode: 'account-only' }));
    localStorage.setItem('free-htl-cloud-pending-v1:user-a', JSON.stringify({ record: { recordId: 'pending' } }));
    localStorage.setItem('free-htl-cloud-cache-v1:user-a', JSON.stringify({ record: { recordId: 'cached' } }));
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({ recordId: 'browser-backup' }));
    localStorage.setItem('htl-theme', 'dark');
  });

  await page.goto('/account/settings.html');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.locator('[data-delete-account-panel]')).toBeVisible();

  const confirmation = page.getByLabel('Confirmation');
  const finalButton = page.getByRole('button', { name: 'Delete account and progress' });
  await confirmation.fill('DELET');
  await expect(finalButton).toBeDisabled();
  await confirmation.fill('DELETE');
  await expect(finalButton).toBeEnabled();
  await finalButton.click();

  await expect(page).toHaveURL(/\/account\/sign-in\.html\?deleted=1$/);
  await expect(page.locator('[data-auth-status]')).toContainText('permanently deleted');

  const invocation = calls.find((call) => call[0] === 'invoke');
  expect(invocation).toBeTruthy();
  expect(invocation[1]).toBe('delete-account');
  expect(invocation[2].body.confirm).toBe('DELETE MY ACCOUNT');

  const state = await page.evaluate(() => ({
    decision: localStorage.getItem('free-htl-cloud-sync-v1'),
    pending: localStorage.getItem('free-htl-cloud-pending-v1:user-a'),
    cache: localStorage.getItem('free-htl-cloud-cache-v1:user-a'),
    progress: localStorage.getItem('free-htl-progress-v1'),
    theme: localStorage.getItem('htl-theme')
  }));
  expect(state.decision).toBeNull();
  expect(state.pending).toBeNull();
  expect(state.cache).toBeNull();
  expect(state.progress).toBeNull();
  expect(state.theme).toBe('dark');
  expect(calls.some((call) => call[0] === 'signOut' && call[1]?.scope === 'local')).toBeTruthy();
});
