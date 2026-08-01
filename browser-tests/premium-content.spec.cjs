const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';
const functionPattern = '**/functions/v1/premium-content';

async function mockSupabase(page, session = null) {
  const script = `
    window.supabase = {
      createClient() {
        const session = ${JSON.stringify(session)};
        const ok = (data = {}) => Promise.resolve({ data, error: null });
        return {
          auth: {
            getSession: () => ok({ session }),
            getUser: () => ok({ user: session ? { id: 'user-a' } : null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            signOut: () => ok({})
          },
          from: () => ({ update: () => ({ eq: () => ok({}) }) }),
          functions: { invoke: () => ok({}) }
        };
      }
    };
  `;
  await page.route(sdkUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: script
  }));
}

function corsHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'access-control-allow-origin': 'http://127.0.0.1:4173',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'private, no-store',
    'content-type': contentType,
    'vary': 'Origin, Authorization',
    'x-content-type-options': 'nosniff'
  };
}

async function mockPremiumEndpoint(page, response) {
  const calls = [];
  await page.route(functionPattern, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    calls.push({
      method: request.method(),
      headers: request.headers(),
      body: request.postDataJSON()
    });
    await route.fulfill({
      status: response.status,
      headers: corsHeaders(),
      body: JSON.stringify(response.body)
    });
  });
  return calls;
}

test('signed-out learner sees a clear sign-in state without requesting lesson content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, null);
  const calls = await mockPremiumEndpoint(page, {
    status: 500,
    body: { error: 'This response should not be reached.' }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in required');
  await expect(page.locator('[data-premium-message]')).toHaveText('Sign in to continue learning.');
  await expect(page.locator('[data-premium-sign-in]')).toHaveText('Sign in to continue');
  await expect(page.locator('[data-premium-sign-in]')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  expect(calls).toHaveLength(0);
  await expect(page.locator('[data-premium-sign-in]')).toHaveAttribute('href', /account\/sign-in\.html\?next=/);
});

test('verified free learner receives a learner-facing Premium state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await mockSupabase(page, {
    access_token: 'free-session-token',
    user: { id: 'user-a' }
  });
  const calls = await mockPremiumEndpoint(page, {
    status: 403,
    body: {
      error: 'An active premium entitlement is required.',
      code: 'upgrade_required',
      requestId: 'request-free-1'
    }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('[data-premium-status-label]')).toHaveText('Included with Premium');
  await expect(page.locator('[data-premium-message]')).toContainText('included with Premium');
  await expect(page.locator('[data-premium-upgrade]')).toHaveText('See what Premium includes');
  await expect(page.locator('[data-premium-upgrade]')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expect(page.locator('[data-premium-request-reference]')).toContainText('request-free-1');
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].headers.authorization).toBe('Bearer free-session-token');
  expect(calls[0].body).toEqual({ contentId: 'processing-proof-v1' });
  expect(calls[0].body.userId).toBeUndefined();
  expect(calls[0].body.entitlement).toBeUndefined();
  expect(calls[0].body.bucket).toBeUndefined();
  expect(calls[0].body.objectPath).toBeUndefined();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('invalid or expired session fails safely and asks the learner to sign in again', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, {
    access_token: 'expired-session-token',
    user: { id: 'user-a' }
  });
  await mockPremiumEndpoint(page, {
    status: 401,
    body: {
      error: 'The account session is invalid or expired.',
      requestId: 'request-expired-1'
    }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in again');
  await expect(page.locator('[data-premium-message]')).toHaveText('Your session ended. Sign in again to continue.');
  await expect(page.locator('[data-premium-sign-in]')).toHaveText('Sign in again');
  await expect(page.locator('[data-premium-sign-in]')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expect(page.locator('[data-premium-request-reference]')).toContainText('request-expired-1');
});

test('entitled learner receives and renders a learner-facing lesson on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await mockSupabase(page, {
    access_token: 'premium-session-token',
    user: { id: 'user-a' }
  });
  const calls = await mockPremiumEndpoint(page, {
    status: 200,
    body: {
      schemaVersion: 1,
      contentId: 'processing-proof-v1',
      title: 'Processing and Decalcification: Core Review',
      summary: 'Review the sequence and the decisions that prevent common processing artifacts.',
      sections: [
        {
          heading: 'Processing sequence',
          paragraphs: ['Tissue processing replaces water with a supportive medium while preserving morphology and analytes.'],
          bullets: [
            'Dehydration removes water.',
            'Clearing replaces the dehydrant.',
            'Infiltration replaces the clearing agent with a supportive medium.'
          ]
        }
      ]
    }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('[data-premium-status-label]')).toHaveText('Lesson ready');
  await expect(page.locator('[data-premium-message]')).toHaveText('Your lesson is ready.');
  await expect(page.locator('[data-premium-content]')).toBeVisible();
  await expect(page.locator('[data-premium-title]')).toHaveText('Processing and Decalcification: Core Review');
  await expect(page.getByRole('heading', { name: 'Processing sequence' })).toBeVisible();
  await expect(page.getByText('Dehydration removes water.')).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].headers.authorization).toBe('Bearer premium-session-token');
  expect(calls[0].body).toEqual({ contentId: 'processing-proof-v1' });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
