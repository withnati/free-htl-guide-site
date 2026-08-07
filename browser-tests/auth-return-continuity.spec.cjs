const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

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
              signUp: () => ok({ session: null }),
              signInWithPassword: () => ok({ session: null }),
              signOut: () => ok({}),
              resetPasswordForEmail: () => ok({}),
              resend: () => ok({}),
              updateUser: () => ok({ user: null })
            },
            functions: { invoke: () => ok({}) },
            from: () => ({ update: () => ({ eq: () => ok({}) }) })
          };
        }
      };
    `
  }));
}

async function expectReturnDestination(page, selector, expectedPath) {
  const links = page.locator(selector);
  await expect(links).toHaveCount(3);
  const destinations = await links.evaluateAll((nodes) => nodes.map((node) => {
    const next = new URL(node.href).searchParams.get('next');
    if (!next) return null;
    const destination = new URL(next);
    return { origin: destination.origin, path: destination.pathname };
  }));
  const currentOrigin = new URL(page.url()).origin;
  for (const destination of destinations) {
    expect(destination).not.toBeNull();
    expect(destination.origin).toBe(currentOrigin);
    expect(destination.path).toBe(expectedPath);
  }
}

test('sign-in to sign-up switch preserves the safe study return destination', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/account/sign-in.html?next=../my-progress.html');

  await expectReturnDestination(page, 'a[href*="sign-up.html"]', '/my-progress.html');
});

test('sign-up to sign-in switch preserves the safe study return destination', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/account/sign-up.html?next=../my-progress.html');

  await expectReturnDestination(page, 'a[href*="sign-in.html"]', '/my-progress.html');
});

test('external auth return destinations are replaced by the safe My Progress fallback', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/account/sign-in.html?next=https%3A%2F%2Fevil.example%2Fcapture');

  await expectReturnDestination(page, 'a[href*="sign-up.html"]', '/my-progress.html');
});
