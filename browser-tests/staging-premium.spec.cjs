const { test, expect } = require('@playwright/test');

const email = process.env.FHL_STAGING_PREMIUM_EMAIL;
const password = process.env.FHL_STAGING_PREMIUM_PASSWORD;

async function signIn(page) {
  await page.goto('/account/sign-in.html?next=%2Fpremium%2Fstudy-plan.html');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page).toHaveURL(/\/premium\/study-plan(?:\.html)?$/);
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Study plan ready');
}

async function enableAccountSync(page) {
  await page.evaluate(async () => {
    const session = await window.FreeHTLAuth.ready;
    if (!session?.user?.id) throw new Error('The designated staging account is not signed in.');
    localStorage.setItem('free-htl-cloud-sync-v1', JSON.stringify({
      userId: session.user.id,
      mode: 'account-only',
      refreshedAt: new Date().toISOString(),
    }));
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Study plan ready');
}

async function openSyncedPlan(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await enableAccountSync(page);
  return { context, page };
}

async function verifyPremiumDashboard(page) {
  await page.goto('/my-progress.html');
  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-premium-ui-state', /^(premium|attention)$/);
  await expect(page.locator('[data-account-status]')).toHaveText('Premium learner account');
  await expect(page.locator('[data-next-step] a')).toHaveAttribute(
    'href', /premium\/(?:study-plan|processing-proof)\.html$/
  );
  await expect(page.locator('[data-module-id="processing-v3"] [data-module-link]')).toHaveAttribute(
    'href', /premium\/processing-proof\.html$/
  );
  await expect(page.getByText('Premium coming soon', { exact: true })).toHaveCount(0);
  await page.goto('/premium/study-plan.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Study plan ready');
}

test('designated Premium account receives all study tasks and persists one across clean sessions', async ({ browser }) => {
  let originalChecked;
  let changed = false;

  const first = await openSyncedPlan(browser);
  try {
    await verifyPremiumDashboard(first.page);
    const tasks = first.page.locator('[data-premium-task-id]');
    await expect(tasks).toHaveCount(35);
    const firstTask = tasks.first();
    originalChecked = await firstTask.isChecked();
    await firstTask.setChecked(!originalChecked);
    await expect(first.page.locator('[data-premium-task-status]')).toContainText('saved to your learning record');
    changed = true;
  } finally {
    await first.context.close();
  }

  const second = await openSyncedPlan(browser);
  try {
    const firstTask = second.page.locator('[data-premium-task-id]').first();
    await expect(firstTask).toBeChecked({ checked: !originalChecked });
    await firstTask.setChecked(originalChecked);
    await expect(second.page.locator('[data-premium-task-status]')).toContainText('saved to your learning record');
    changed = false;
  } finally {
    if (changed && originalChecked !== undefined) {
      const firstTask = second.page.locator('[data-premium-task-id]').first();
      await firstTask.setChecked(originalChecked).catch(() => {});
      await second.page.waitForTimeout(500).catch(() => {});
    }
    await second.context.close();
  }

  const verification = await openSyncedPlan(browser);
  try {
    await expect(verification.page.locator('[data-premium-task-id]').first()).toBeChecked({ checked: originalChecked });
  } finally {
    await verification.context.close();
  }
});
