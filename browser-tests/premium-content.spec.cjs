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
            onAuthStateChange: (callback) => {
              window.__freeHTLEmitAuthState = (event, nextSession) => callback(event, nextSession);
              return { data: { subscription: { unsubscribe() {} } } };
            },
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
    if (response.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, response.delayMs));
    }
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

  await page.goto('/premium/processing-proof.html?private_token=do-not-forward#lesson');

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'signed-out');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in required');
  await expect(page.locator('[data-premium-message]')).toHaveText('Sign in to continue learning.');
  await expect(page.locator('[data-premium-sign-in]')).toHaveText('Sign in to continue');
  await expect(page.locator('[data-premium-sign-in]')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  expect(calls).toHaveLength(0);
  await expect(page.locator('[data-premium-sign-in]')).toHaveAttribute('href', /account\/sign-in\.html\?next=/);
  await expect(page.locator('[data-premium-sign-in]')).not.toHaveAttribute('href', /private_token|do-not-forward|#lesson/);
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

test('loading and server-error states remain explicit and keep protected payload fields empty', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, {
    access_token: 'premium-session-token',
    user: { id: 'user-a' }
  });
  await mockPremiumEndpoint(page, {
    delayMs: 1500,
    status: 503,
    body: {
      error: 'Temporary staging failure.',
      requestId: 'request-error-1'
    }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'loading');
  await expect(page.locator('[data-premium-state]')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.premium-loader')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'error');
  await expect(page.locator('[data-premium-state]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Could not load lesson');
  await expect(page.locator('[data-premium-retry]')).toBeVisible();
  await expect(page.locator('[data-premium-request-reference]')).toContainText('request-error-1');
  await expect(page.locator('[data-premium-title]')).toBeEmpty();
  await expect(page.locator('[data-premium-summary]')).toBeEmpty();
  await expect(page.locator('[data-premium-sections]')).toBeEmpty();
});

test('offline learner sees a secure retry state without requesting or retaining lesson content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.addInitScript(() => {
    window.__freeHTLOnline = false;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => window.__freeHTLOnline
    });
  });
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
      summary: 'Secure retry response.',
      sections: []
    }
  });

  await page.goto('/premium/processing-proof.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'offline');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Offline');
  await expect(page.locator('[data-premium-message]')).toContainText('Reconnect');
  await expect(page.locator('[data-premium-retry]')).toBeVisible();
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expect(page.locator('[data-premium-title]')).toBeEmpty();
  await expect(page.locator('[data-premium-sections]')).toBeEmpty();
  expect(calls).toHaveLength(0);

  await page.evaluate(() => { window.__freeHTLOnline = true; });
  await page.locator('[data-premium-retry]').click();
  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'authorized');
  await expect(page.locator('[data-premium-title]')).toHaveText('Processing and Decalcification: Core Review');
  expect(calls).toHaveLength(1);
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

  await page.evaluate(() => window.__freeHTLEmitAuthState('SIGNED_OUT', null));
  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'signed-out');
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expect(page.locator('[data-premium-title]')).toBeEmpty();
  await expect(page.locator('[data-premium-summary]')).toBeEmpty();
  await expect(page.locator('[data-premium-sections]')).toBeEmpty();
  await expect(page.getByText('Dehydration removes water.')).toHaveCount(0);
});

test('entitled learner opens the protected Embedding lesson without assessment content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, { access_token: 'premium-session-token', user: { id: 'user-a' } });
  const calls = await mockPremiumEndpoint(page, {
    status: 200,
    body: {
      schemaVersion: 1,
      contentId: 'embedding-microtomy-v1',
      title: 'Embedding and Microtomy',
      summary: 'Review orientation, sectioning controls, artifacts, cryostat work, quality control, and safety.',
      sections: [{
        heading: '1. Orientation principles',
        paragraphs: ['Think about the plane of section before the tissue touches molten paraffin.'],
        bullets: ['GI biopsy — Place on edge with mucosa facing the same direction.']
      }]
    }
  });

  await page.goto('/premium/embedding-microtomy.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'authorized');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Lesson ready');
  await expect(page.locator('[data-premium-title]')).toHaveText('Embedding and Microtomy');
  await expect(page.getByRole('heading', { name: '1. Orientation principles' })).toBeVisible();
  await expect(page.locator('fieldset')).toHaveCount(0);
  await expect(page.locator('[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({ contentId: 'embedding-microtomy-v1' });
  expect(calls[0].body.userId).toBeUndefined();
  expect(calls[0].body.objectPath).toBeUndefined();
});

test('entitled learner opens the protected study plan and retains task progress', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, {
    access_token: 'premium-session-token',
    user: { id: 'user-a' }
  });
  const calls = await mockPremiumEndpoint(page, {
    status: 200,
    body: {
      schemaVersion: 1,
      contentId: 'study-plan-v1',
      title: 'Six-week HT/HTL study plan',
      summary: 'Build a consistent preparation routine one task at a time.',
      sections: [
        {
          heading: 'Week 1 — Fixation and preanalytics',
          paragraphs: ['Begin with the public Fixation lesson and active recall.'],
          tasks: [
            { id: 'w1d1', text: 'Complete the Fixation guide through preanalytics.' },
            { id: 'w1d2', text: 'Build a comparison table for major fixatives.' }
          ]
        }
      ]
    }
  });

  await page.goto('/premium/study-plan.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'authorized');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Study plan ready');
  await expect(page.locator('[data-premium-message]')).toHaveText('Your study plan is ready.');
  await expect(page.getByRole('heading', { name: 'Week 1 — Fixation and preanalytics' })).toBeVisible();
  await expect(page.locator('[data-premium-task-status]')).toContainText('connected to your learning record');
  const firstTask = page.locator('[data-premium-task-id="w1d1"]');
  await expect(firstTask).not.toBeChecked();
  await firstTask.check();
  await expect(page.locator('[data-premium-task-status]')).toContainText('saved to your learning record');
  expect(await page.evaluate(async () => {
    const snapshot = await window.FreeHTLProgress.getSnapshot();
    return snapshot.studyTasks['study-plan-v1:w1d1'];
  })).toMatchObject({ page: 'study-plan-v1', taskId: 'w1d1', checked: true });

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-premium-content-state', 'authorized');
  await expect(page.locator('[data-premium-task-id="w1d1"]')).toBeChecked();
  expect(calls).toHaveLength(2);
  expect(calls[0].body).toEqual({ contentId: 'study-plan-v1' });
  expect(calls[0].body.userId).toBeUndefined();
  expect(calls[0].body.objectPath).toBeUndefined();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
