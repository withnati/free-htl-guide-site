const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

function progressRecord(completedModules) {
  const timestamp = '2026-08-07T18:00:00.000Z';
  return {
    schemaVersion: 2,
    recordId: 'progress-release-recommendation',
    createdAt: timestamp,
    updatedAt: timestamp,
    owner: { kind: 'anonymous', anonymousId: 'anon-release-test', accountId: null },
    entitlement: { tier: 'public', status: 'preview', source: 'local-development', updatedAt: timestamp },
    modules: {},
    studyTasks: {},
    quizAttempts: completedModules.map((page, index) => ({
      id: `quiz-release-${index + 1}`,
      page,
      quizId: `${page}-quiz`,
      score: 9,
      total: 10,
      percent: 90,
      targetMet: true,
      completedAt: timestamp,
      legacy: false
    })),
    mockExamAttempts: [],
    targetedPracticeAttempts: [],
    activeSessions: {},
    activity: [],
    migration: { legacyVersion: 1, completedAt: timestamp, importedRecords: 0 }
  };
}

async function mockSignedOutSupabase(page) {
  await page.route(sdkUrl, async (route) => {
    const body = `
      window.supabase = {
        createClient() {
          const ok = (data) => Promise.resolve({ data, error: null });
          return {
            auth: {
              getSession: () => ok({ session: null }),
              getUser: () => ok({ user: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
              signOut: () => ok({})
            },
            from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
            functions: { invoke: () => ok({}) }
          };
        }
      };
    `;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body });
  });
}

async function openDashboardWithProgress(page, completedModules) {
  await mockSignedOutSupabase(page);
  const record = progressRecord(completedModules);
  await page.addInitScript((value) => {
    localStorage.setItem('free-htl-progress-v1', JSON.stringify(value));
    localStorage.setItem('free-htl-analytics-consent', JSON.stringify({ status: 'denied', version: '2026-07-31' }));
  }, record);
  await page.goto('/my-progress.html');
  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
}

test('after Fixation, free learners see Processing as available now with Premium', async ({ page }) => {
  await openDashboardWithProgress(page, ['fixation-v3']);

  const nextStep = page.locator('[data-next-step]');
  await expect(nextStep.getByRole('heading', { name: 'Start Processing and Decalcification' })).toBeVisible();
  await expect(nextStep).toContainText('available now with Premium');
  await expect(nextStep).not.toContainText('premium access in the final product');
  await expect(nextStep.getByRole('link', { name: 'View Premium lesson' })).toHaveAttribute(
    'href',
    /modules\/processing-guide-v3\.html$/
  );
  await expect(nextStep.locator('.access-premium')).toHaveText('Premium');
});

test('later unreleased Premium lessons are labeled release in progress', async ({ page }) => {
  await openDashboardWithProgress(page, ['fixation-v3', 'processing-v3', 'embedding-v3']);

  const nextStep = page.locator('[data-next-step]');
  await expect(nextStep.getByRole('heading', { name: 'Start Routine H&E Staining' })).toBeVisible();
  await expect(nextStep).toContainText('secure Premium release is still in progress');
  await expect(nextStep.getByRole('link', { name: 'View release status' })).toHaveAttribute(
    'href',
    /modules\/staining-he-guide\.html$/
  );
  await expect(nextStep.locator('.access-premium')).toHaveText('Premium');
});
