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

async function mockPremiumSupabase(page, status = {
  state: 'active', premiumAccess: true, billingCadence: 'annual',
  currentPeriodEnd: '2027-08-03T00:00:00.000Z', graceUntil: null,
  cancelAtPeriodEnd: false, canManageBilling: true
}, invokeError = null) {
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
                ? ({ data: ${JSON.stringify(status)}, error: ${JSON.stringify(invokeError)} })
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

test('public homepage leads with HT and HTL exam preparation', async ({ page }) => {
  await mockSignedOutSupabase(page);
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
  await expect(page.getByText(/Premium enrollment is open/)).toBeVisible();
  await expect(page.getByText(/secure Premium experiences available now/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build with secure Premium releases' })).toBeVisible();
  await expect(page.locator('.resource-card')).toHaveCount(6);

  const publicDownloads = await page.locator('.resource-card').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(publicDownloads).not.toContain('assets/Processing_Schedules_Templates.pdf');
  expect(publicDownloads).not.toContain('assets/Decalc_Endpoint_SOP.pdf');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('server-controlled entitlement');
  expect(body).not.toContain('question payload');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /\/assets\/app-icon\.svg$/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/site\.webmanifest$/);
  await expectNoHorizontalOverflow(page);
});

test('FAQ states current Premium availability without stale enrollment claims', async ({ page }) => {
  await page.goto('/faq.html');

  await expect(page.getByText('Secure learning library available')).toBeVisible();
  const premiumFaq = page.locator('details').filter({ hasText: 'What is included with Premium now?' });
  await expect(premiumFaq).toContainText('Processing and Decalcification lesson');
  await expect(premiumFaq).toContainText('Embedding and Microtomy lesson');
  await expect(premiumFaq).toContainText('six-week study plan');
  await expect(page.getByText('Premium enrollment is not open yet.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Premium library' })).toHaveAttribute(
    'href', /premium\/index\.html$/
  );

  const faqData = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
    nodes.map((node) => JSON.parse(node.textContent)).find((item) => item['@type'] === 'FAQPage')
  );
  const premiumAnswer = faqData.mainEntity.find((item) => item.name === 'What is included with Premium now?');
  expect(premiumAnswer.acceptedAnswer.text).toContain('securely delivered Processing and Decalcification lesson');
  expect(premiumAnswer.acceptedAnswer.text).toContain('Embedding and Microtomy lesson');
  expect(JSON.stringify(faqData)).not.toContain('planned to include');
  await expectNoHorizontalOverflow(page);
});

test('pricing separates current Premium access from unreleased tools', async ({ page }) => {
  await page.goto('/pricing.html');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('current tools fit your study plan');
  await expect(page.getByText('Available now:', { exact: true })).toHaveCount(4);
  await expect(page.getByText('Secure release in progress:', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('row', { name: /Processing and Decalcification/ })).toContainText('Available now');
  await expect(page.getByRole('row', { name: /Embedding and Microtomy/ })).toContainText('Available now');
  await expect(page.getByRole('row', { name: /Remaining lessons and complete quizzes/ })).toContainText(
    'Release in progress'
  );
  await expect(page.getByText('“Release in progress” means the feature is not available for study yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose monthly Premium' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('complete public Fixation lesson uses the canonical runtime in the generated deployment', async ({ page }) => {
  await page.goto('/modules/fixation-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'fixation-v3');
  await expect(page.locator('body')).toHaveAttribute('data-fixation-runtime', 'active');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fixation');
  await expect(page.locator('#fixQuiz fieldset[data-question-id]')).toHaveCount(10);
  await expect(page.locator('#fixQuiz fieldset[data-question-version="1"]')).toHaveCount(10);
  await expect(page.locator('#fixQuiz fieldset[data-correct]')).toHaveCount(0);

  const firstChoice = page.locator('#fixQuiz input[type="radio"]').first();
  await firstChoice.check();
  await page.locator('[data-grade="fixQuiz"]').click();
  await expect(page.locator('#quizResult')).toBeVisible();
  await expect(page.locator('#quizResult')).toContainText(/Score: \d+\/10/);
  await expect(page.locator('#fixQuiz .explanation:not([hidden])')).toHaveCount(10);

  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')));
  expect(progress.quizAttempts).toHaveLength(1);
  expect(progress.quizAttempts[0].page).toBe('fixation-v3');
  expect(progress.quizAttempts[0].quizId).toBe('fixQuiz');
  expect(progress.quizAttempts[0].total).toBe(10);

  await page.locator('[data-grade="fixQuiz"]').click();
  const afterDuplicateClick = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')));
  expect(afterDuplicateClick.quizAttempts).toHaveLength(1);

  await expect(page.getByRole('link', { name: 'Download resources' })).toHaveAttribute(
    'href',
    /assets\/all-fixation-downloads\.zip$/
  );
  await expectNoHorizontalOverflow(page);
});

test('custom 404 recovery page ships in the generated deployment', async ({ page }) => {
  await page.goto('/404.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'not-found');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that study page');
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the HT/HTL course' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('premium lesson route contains a learner-facing preview without lesson or quiz payload', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/modules/processing-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Processing and Decalcification');
  await expect(page.getByText('Premium preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Processing and Decalcification is included with Premium.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review my Premium access' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Open secure lesson' })).toBeHidden();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expect(page.locator('script[src*="mock-exam"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('protected-delivery proof');
  expect(body).not.toContain('authorized delivery');
  await expectNoHorizontalOverflow(page);
});

test('Embedding preview links entitled learners to the protected shell without assessment content', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/modules/embedding-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Embedding and Microtomy');
  await expect(page.getByText('Premium access confirmed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open secure lesson' })).toHaveAttribute(
    'href', /premium\/embedding-microtomy\.html$/
  );
  await expect(page.locator('fieldset')).toHaveCount(0);
  await expect(page.locator('[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('Premium account receives an entitlement-aware homepage shell', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.getByText(/Your Premium access is active/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Premium library' }).first()).toHaveAttribute(
    'href', /premium\/index\.html$/
  );
  await expect(page.getByRole('link', { name: 'Open Premium library' }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open lesson' }).first()).toBeVisible();
  await expect(page.getByText(/securely delivered Processing and Embedding lessons/)).toBeVisible();
  await expect(page.getByText(/New protected releases will appear in your library after verification/)).toBeVisible();
  await expect(page.getByText(/complete course, practice, mock exams/)).toHaveCount(0);
  await expect(page.getByText('Premium enrollment is not open yet.')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('signed-out Premium library keeps learning content gated', async ({ page }) => {
  await mockSignedOutSupabase(page);
  await page.goto('/premium/index.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'signed-out');
  await expect(page.getByRole('heading', { name: 'Sign in to open your library' })).toBeVisible();
  await expect(page.locator('[data-premium-hub-library]')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', /account\/sign-in\.html/);
  await expectNoHorizontalOverflow(page);
});

test('Premium library shows only available and truthfully staged learning', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/premium/index.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.getByText('Premium access confirmed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open lesson' })).toHaveAttribute('href', 'processing-proof.html');
  await expect(page.getByRole('link', { name: 'Open Embedding lesson' })).toHaveAttribute('href', 'embedding-microtomy.html');
  await expect(page.getByRole('link', { name: 'Open study plan' })).toHaveAttribute('href', 'study-plan.html');
  await expect(page.getByText('Secure release in progress')).toHaveCount(3);
  await expect(page.locator('[data-premium-hub-upgrade]')).toBeHidden();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('offline Premium library stays gated without implying an entitlement change', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  });
  await mockPremiumSupabase(page, null, { message: 'Failed to fetch' });
  await page.goto('/premium/index.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'offline');
  await expect(page.locator('[data-premium-hub-label]')).toHaveText('Offline');
  await expect(page.getByRole('heading', { name: 'Reconnect to confirm your library' })).toBeVisible();
  await expect(page.getByText('Your account and access have not been changed.')).toBeVisible();
  await expect(page.locator('[data-premium-hub-library]')).toBeHidden();
  await expect(page.locator('[data-premium-hub-upgrade]')).toBeHidden();
  await expect(page.locator('[data-premium-hub-error-plan]')).toBeHidden();
  await expect(page.locator('[data-premium-hub-retry]')).toBeVisible();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('offline practice preview keeps protected tools locked without showing an upgrade prompt', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  });
  await mockPremiumSupabase(page, null, { message: 'Failed to fetch' });
  await page.goto('/mock-exam.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'offline');
  await expect(page.locator('[data-premium-preview-label]')).toHaveText('Offline');
  await expect(page.locator('[data-premium-preview-message]')).toContainText('Reconnect to confirm access');
  await expect(page.getByText('Your account has not been changed.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Compare Premium plans' })).toBeHidden();
  await expect(page.locator('[data-start-exam]')).toHaveCount(0);
  await expect(page.locator('script[src*="mock-exam"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('Premium dashboard projects trusted access and links to the library', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/my-progress.html');

  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.getByText('Premium learning account')).toBeVisible();
  await expect(page.locator('[data-account-status]')).toHaveText('Premium learner account');
  await expect(page.locator('[data-access-status]')).toHaveText('Premium content');
  await expect(page.getByRole('link', { name: 'Open Premium library' }).first()).toHaveAttribute(
    'href', /premium\/index\.html$/
  );
  await expect(page.getByRole('heading', { name: 'Start your six-week study plan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open study plan' })).toHaveAttribute(
    'href', /premium\/study-plan\.html$/
  );
  await expect(page.locator('[data-module-id="processing-v3"] [data-module-link]')).toHaveAttribute(
    'href', /premium\/processing-proof\.html$/
  );
  await expect(page.locator('[data-module-id="embedding-v3"] [data-module-link]')).toHaveAttribute(
    'href', /premium\/embedding-microtomy\.html$/
  );
  await expect(page.locator('[data-module-progress] .module-release-ready')).toHaveCount(2);
  await expect(page.locator('[data-module-progress] .module-release-upcoming')).toHaveCount(4);
  await expect(page.locator('.module-status .status-value').filter({ hasText: 'Release in progress' })).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
});

test('Premium dashboard moves from a completed study plan to the secure Processing lesson', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.addInitScript(() => {
    const studyTasks = {};
    for (let index = 1; index <= 35; index += 1) {
      studyTasks[`study-plan-v1:task-${index}`] = {
        page: 'study-plan-v1', taskId: `task-${index}`, checked: true,
        updatedAt: '2026-08-06T00:00:00.000Z'
      };
    }
    localStorage.setItem('free-htl-progress-v1', JSON.stringify({
      schemaVersion: 1,
      owner: { kind: 'anonymous', accountId: null },
      entitlement: { tier: 'public', source: 'local-default', updatedAt: null },
      modules: {}, studyTasks, quizAttempts: [], mockExamAttempts: [], targetedPracticeAttempts: [],
      activeSessions: {}, activity: [], migration: { legacyVersion: 1, migratedAt: null },
      createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z'
    }));
  });
  await page.goto('/my-progress.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.getByRole('heading', { name: 'Continue with Processing and Decalcification' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open lesson' })).toHaveAttribute(
    'href', /premium\/processing-proof\.html$/
  );
});

test('Premium processing route confirms access without exposing protected payloads', async ({ page }) => {
  await mockPremiumSupabase(page);
  await page.goto('/modules/processing-guide-v3.html');

  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', 'premium');
  await expect(page.getByText('Premium access confirmed')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your account includes Processing and Decalcification.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open secure lesson' })).toHaveAttribute(
    'href', /premium\/processing-proof\.html$/
  );
  await expect(page.getByRole('link', { name: 'Compare Premium plans' })).toBeHidden();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expect(page.locator('[data-expl]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('public mock-exam route previews exam value without shipping the runtime or question bank', async ({ page }) => {
  await page.goto('/mock-exam.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('50-question HT/HTL mock exam');
  await expect(page.getByText('Premium preview', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-start-exam]')).toHaveCount(0);
  await expect(page.locator('script[src*="mock-exam"]')).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Loading question bank');
  expect(body).toContain('domain results');
  await expectNoHorizontalOverflow(page);
});

test('public study-plan route remains a preview without protected task content', async ({ page }) => {
  await page.goto('/study-plan.html');

  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Six-week HT/HTL study plan');
  await expect(page.getByText('Premium preview', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-protected-content-id]')).toHaveCount(0);
  await expect(page.locator('[data-premium-task-id]')).toHaveCount(0);
  await expect(page.locator('script[src*="premium-content-client"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('protected Premium study-plan shell ships without its private task payload', async ({ page }) => {
  await page.goto('/premium/study-plan.html');
  await expect(page.locator('body')).toHaveAttribute('data-protected-content-id', 'study-plan-v1');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in required');
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expect(page.locator('[data-premium-task-id]')).toHaveCount(0);
  expect(await page.content()).not.toContain('plans/study-plan-v1.json');
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
