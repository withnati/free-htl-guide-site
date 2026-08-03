const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

function expectNoindex(response) {
  expect(response).toBeTruthy();
  expect(response.headers()['x-robots-tag'] || '').toContain('noindex');
}

test('live staging homepage presents the HT/HTL preparation journey', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  expectNoindex(response);
  await expect(page).toHaveTitle(/HT and HTL Exam Preparation/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prepare confidently for the HT or HTL exam');
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' }).first()).toBeVisible();
  await expect(page.getByText('Free', { exact: true })).toBeVisible();
  await expect(page.getByText('Premium', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Premium enrollment is open/)).toBeVisible();
  const visibleCopy = await page.locator('body').innerText();
  expect(visibleCopy).not.toContain('server-controlled entitlement');
  expect(visibleCopy).not.toContain('question payload');
  expect(visibleCopy).not.toContain('Layer 14');
  await expectNoHorizontalOverflow(page);
});

test('live staging Premium route is a learner-facing preview', async ({ page }) => {
  const response = await page.goto('/modules/processing-guide-v3.html', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  expectNoindex(response);
  expect(response.headers()['cache-control'] || '').toContain('private');
  await expect(page.locator('body')).toHaveAttribute('data-page', 'premium-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Processing and Decalcification');
  await expect(page.getByText('Premium preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  await expect(page.locator('fieldset[data-correct]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('live staging sign-in page explains the learner benefit', async ({ page }) => {
  const response = await page.goto('/account/sign-in.html', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  expectNoindex(response);
  expect(response.headers()['cache-control'] || '').toContain('private');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to continue studying');
  await expect(page.getByText(/saved progress, recent activity/i)).toBeVisible();
  await expect(page.locator('form[data-sign-in-form]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('live staging Premium lesson shell fails safely for a signed-out learner', async ({ page }) => {
  const response = await page.goto('/premium/processing-proof.html', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  expectNoindex(response);
  expect(response.headers()['cache-control'] || '').toContain('private');
  await expect(page.locator('[data-premium-status-label]')).toHaveText('Sign in required');
  await expect(page.locator('[data-premium-message]')).toHaveText('Sign in to continue learning.');
  await expect(page.locator('[data-premium-sign-in]')).toHaveText('Sign in to continue');
  await expect(page.locator('[data-premium-content]')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('live staging progress page keeps a signed-out learner on the device', async ({ page }) => {
  const response = await page.goto('/my-progress.html', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  expectNoindex(response);
  await expect(page.locator('body')).toHaveAttribute('data-progress-dashboard-loaded', 'true');
  await expect(page.locator('[data-account-status]')).toHaveText('Using this device');
  await expect(page.locator('[data-storage-status]')).toHaveText('On this device');
  await expectNoHorizontalOverflow(page);
});

test('live staging serves the custom exam-preparation 404 page', async ({ page }) => {
  const response = await page.goto('/layer-14-5-missing-study-page', { waitUntil: 'domcontentloaded' });
  expect(response).toBeTruthy();
  expect(response.status()).toBe(404);
  expectNoindex(response);
  await expect(page.locator('body')).toHaveAttribute('data-page', 'not-found');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that study page');
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the HT/HTL course' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('live staging mobile navigation opens and reaches the course', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'staging-mobile-chromium');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
  await page.locator('#mobileMenu').getByRole('link', { name: 'Course' }).click();
  await expect(page).toHaveURL(/\/#modules$/);
  await expect(page.locator('#modules')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
