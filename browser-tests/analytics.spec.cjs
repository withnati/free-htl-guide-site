const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');
const baseConfig = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'data', 'analytics-config.json'), 'utf8')
);

function enabledConfig(overrides = {}) {
  return {
    ...baseConfig,
    enabled: true,
    measurementId: 'G-TEST1234',
    ...overrides
  };
}

async function mockEnabledAnalytics(page, overrides = {}) {
  const googleRequests = [];
  await page.route('**/data/analytics-config.json', async (route) => {
    await route.fulfill({ json: enabledConfig(overrides) });
  });
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleRequests.push(route.request().url());
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__freeHtlGoogleTagMockLoaded = true;'
    });
  });
  return googleRequests;
}

async function dataLayerEntries(page) {
  return page.evaluate(() => (window.dataLayer || []).map((entry) => Array.from(entry)));
}

test('activated analytics remains blocked before consent and exposes equal choices', async ({ page }) => {
  const googleRequests = [];
  page.on('request', (request) => {
    if (/google(?:tagmanager|-analytics)\.com/.test(request.url())) googleRequests.push(request.url());
  });

  await page.goto('/?analytics_debug=1', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toHaveAttribute('data-analytics-configured', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'unset');
  await expect(page.getByRole('button', { name: 'Privacy choices' })).toBeVisible();
  await expect(page.locator('[data-analytics-banner]')).toBeVisible();
  await expect(page.locator('[data-analytics-banner] [data-analytics-consent="granted"]')).toBeVisible();
  await expect(page.locator('[data-analytics-banner] [data-analytics-consent="denied"]')).toBeVisible();

  await page.getByRole('button', { name: 'Privacy choices' }).click();
  await expect(page.locator('[data-analytics-dialog]')).toBeVisible();
  await expect(page.locator('[data-analytics-state]')).toHaveText('No analytics choice has been saved on this device.');
  await expect(page.locator('[data-analytics-actions]')).toBeVisible();
  await expect(page.locator('[data-analytics-debug]')).toContainText('Analytics debug · unset');

  const debugEvents = await page.evaluate(() => window.FreeHTLAnalytics.debugEvents);
  expect(debugEvents.some((entry) => entry.eventName === 'page_view')).toBeTruthy();
  expect(googleRequests).toEqual([]);
});

test('declining analytics persists without loading any Google tag', async ({ page }) => {
  const googleRequests = await mockEnabledAnalytics(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('[data-analytics-banner]')).toBeVisible();
  await page.locator('[data-analytics-banner] [data-analytics-consent="denied"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'denied');
  await expect(page.locator('[data-analytics-banner]')).toHaveCount(0);
  expect(googleRequests).toEqual([]);

  const consent = await page.evaluate(() => JSON.parse(
    localStorage.getItem('free-htl-analytics-consent')
  ));
  expect(consent.status).toBe('denied');
  expect(consent.version).toBe('2026-07-31');

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'denied');
  await expect(page.locator('[data-analytics-banner]')).toHaveCount(0);
  expect(googleRequests).toEqual([]);
});

test('granting analytics loads one tag and sends only allowlisted sanitized events', async ({ page }) => {
  const googleRequests = await mockEnabledAnalytics(page);
  await page.goto('/modules/fixation-guide-v3.html?private_token=secret', { waitUntil: 'networkidle' });

  await page.locator('[data-analytics-banner] [data-analytics-consent="granted"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'granted');
  await expect(page.locator('body')).toHaveAttribute('data-analytics-active', 'true');
  expect(googleRequests).toHaveLength(1);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('htl:quiz-graded', {
      detail: {
        quizId: 'fixationQuiz',
        score: 8,
        total: 10,
        percent: 80,
        targetMet: true,
        email: 'must-not-send@example.com',
        answer: 'C'
      }
    }));
    window.dispatchEvent(new CustomEvent('htl:share', {
      detail: {
        method: 'canonical_copy',
        page: 'fixation-v3',
        url: 'https://withnati.github.io/free-htl-guide-site/modules/fixation-guide-v3.html?token=secret#answers'
      }
    }));
  });

  const entries = await dataLayerEntries(page);
  const pageView = entries.find((entry) => entry[0] === 'event' && entry[1] === 'page_view');
  expect(pageView).toBeTruthy();
  expect(pageView[2].page_location).toBe(
    'http://127.0.0.1:4173/modules/fixation-guide-v3.html'
  );

  const quiz = entries.find((entry) => entry[0] === 'event' && entry[1] === 'quiz_complete');
  expect(quiz[2]).toMatchObject({
    quiz_id: 'fixationQuiz',
    score: 8,
    total_questions: 10,
    score_percent: 80,
    score_band: '80-100',
    target_met: true
  });
  expect(JSON.stringify(quiz[2])).not.toContain('must-not-send');
  expect(JSON.stringify(quiz[2])).not.toContain('answer');

  const share = entries.find((entry) => entry[0] === 'event' && entry[1] === 'share');
  expect(share[2].share_url).toBe(
    'https://withnati.github.io/free-htl-guide-site/modules/fixation-guide-v3.html'
  );
});

test('revoking consent clears analytics cookies, stops events, and supports re-consent', async ({ page, context }) => {
  const googleRequests = await mockEnabledAnalytics(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-analytics-banner] [data-analytics-consent="granted"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-analytics-active', 'true');
  expect(googleRequests).toHaveLength(1);

  await page.evaluate(() => {
    document.cookie = '_ga=test; path=/; SameSite=Lax; Secure';
    document.cookie = '_ga_TEST1234=test; path=/; SameSite=None; Secure';
  });
  const eventsBeforeOpeningChoices = (await dataLayerEntries(page))
    .filter((entry) => entry[0] === 'event').length;

  await page.getByRole('button', { name: 'Privacy choices' }).click();
  await page.locator('[data-analytics-dialog] [data-analytics-consent="denied"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'denied');
  await expect(page.locator('body')).toHaveAttribute('data-analytics-active', 'false');
  expect((await context.cookies()).filter((cookie) => /^_ga/.test(cookie.name))).toEqual([]);

  const eventsAtRevocation = (await dataLayerEntries(page))
    .filter((entry) => entry[0] === 'event').length;
  expect(eventsAtRevocation).toBeGreaterThanOrEqual(eventsBeforeOpeningChoices);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('htl:quiz-reset', {
      detail: { quizId: 'after-revocation' }
    }));
  });
  const eventsAfterRevokedAttempt = (await dataLayerEntries(page))
    .filter((entry) => entry[0] === 'event').length;
  expect(eventsAfterRevokedAttempt).toBe(eventsAtRevocation);

  await page.getByRole('button', { name: 'Privacy choices' }).click();
  await page.locator('[data-analytics-dialog] [data-analytics-consent="granted"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-analytics-consent', 'granted');
  await expect(page.locator('body')).toHaveAttribute('data-analytics-active', 'true');
  expect(googleRequests).toHaveLength(1);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('htl:quiz-reset', {
      detail: { quizId: 'after-reconsent' }
    }));
  });
  const eventNamesAfterReconsent = (await dataLayerEntries(page))
    .filter((entry) => entry[0] === 'event')
    .map((entry) => entry[1]);
  expect(eventNamesAfterReconsent.slice(eventsAtRevocation)).toEqual(['page_view', 'quiz_reset']);
});
