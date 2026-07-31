const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..');
const productionPrefix = '/free-htl-guide-site/';
const sitemap = fs.readFileSync(path.join(projectRoot, 'sitemap.xml'), 'utf8');
const productionUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

function localPath(productionUrl) {
  const pathname = new URL(productionUrl).pathname;
  if (!pathname.startsWith(productionPrefix)) {
    throw new Error(`Sitemap URL is outside the project prefix: ${productionUrl}`);
  }
  const relative = pathname.slice(productionPrefix.length);
  return relative ? `/${relative}` : '/';
}

function collectBrowserProblems(page) {
  const problems = [];

  page.on('pageerror', (error) => {
    problems.push(`Page error: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`Console error: ${message.text()}`);
  });

  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      problems.push(`Local request failed: ${url.pathname} (${request.failure()?.errorText || 'unknown error'})`);
    }
  });

  return problems;
}

async function expectPageToRender(page, urlPath) {
  const problems = collectBrowserProblems(page);
  const response = await page.goto(urlPath, { waitUntil: 'domcontentloaded' });
  expect(response, `No response for ${urlPath}`).not.toBeNull();
  expect(response.ok(), `Unexpected HTTP status for ${urlPath}`).toBeTruthy();
  await page.waitForFunction(() => document.readyState === 'complete');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `Horizontal overflow on ${urlPath}: ${overflow.scrollWidth}px > ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);

  const brokenImages = await page.locator('img').evaluateAll((images) => images
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.getAttribute('src') || '(missing src)'));
  expect(brokenImages, `Broken images on ${urlPath}`).toEqual([]);
  expect(problems, `Browser errors on ${urlPath}`).toEqual([]);
}

test.describe('canonical pages', () => {
  for (const productionUrl of productionUrls) {
    const urlPath = localPath(productionUrl);
    test(`${urlPath} renders without browser errors or overflow`, async ({ page }) => {
      await expectPageToRender(page, urlPath);
    });
  }
});

test('desktop navigation opens a current module', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/');
  await page.getByRole('link', { name: 'Open Fixation' }).click();
  await expect(page).toHaveURL(/\/modules\/fixation-guide-v3\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Fixation' })).toBeVisible();
});

test('mobile menu opens, updates ARIA, and navigates', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
  await page.locator('#mobileMenu').getByRole('link', { name: 'Study plan' }).click();
  await expect(page).toHaveURL(/\/study-plan\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/study plan/i);
});

test('dark mode persists after reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('htl-theme'));
  await page.reload();

  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('htl-theme'))).toBe('dark');

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('study-plan progress persists locally', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/study-plan.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const firstTask = page.locator('input[data-check]').first();
  await expect(firstTask).toBeVisible();
  await firstTask.check();
  await page.reload();
  await expect(firstTask).toBeChecked();
});

test('quiz grading and reset work in the browser', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/modules/fixation-guide-v3.html#quiz');

  const firstQuestion = page.locator('fieldset[data-correct]').first();
  const correctValue = await firstQuestion.getAttribute('data-correct');
  await firstQuestion.locator(`input[value="${correctValue}"]`).check();
  await page.locator('[data-grade]').click();

  await expect(page.locator('.quiz-result')).toContainText('Score: 1/10');
  await expect(firstQuestion).toHaveClass(/correct/);

  await page.locator('[data-retry]').click();
  await expect(page.locator('.quiz-result')).toBeHidden();
  await expect(firstQuestion.locator('input:checked')).toHaveCount(0);
});

test('signup requires consent and redirects after a mocked success', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  let submittedBody = '';

  await page.route('https://formspree.io/**', async (route) => {
    submittedBody = route.request().postData() || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/#starter');
  const form = page.locator('#emailSignupForm');
  const email = form.locator('input[name="email"]');
  const consent = form.locator('input[name="consent"]');

  await expect(consent).toHaveCount(1);
  await expect(form.locator('input[name="source"]')).toHaveCount(1);
  await expect(form.locator('input[name="subscription_type"]')).toHaveCount(1);

  await email.fill('qa@example.com');
  await form.getByRole('button', { name: 'Subscribe' }).click();
  expect(await consent.evaluate((element) => element.validity.valueMissing)).toBe(true);
  expect(submittedBody).toBe('');

  await consent.check();
  await form.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page).toHaveURL(/\/thank-you\.html\?source=email-signup$/);
  expect(submittedBody).toContain('qa@example.com');
  expect(submittedBody).toContain('name="consent"');
  expect(await page.evaluate(() => sessionStorage.getItem('free-htl-signup-success'))).toBe('1');
});

test('legacy module URLs redirect directly to current guides', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const redirects = [
    ['/modules/fixation.html#quiz', '/modules/fixation-guide-v3.html#quiz'],
    ['/modules/processing.html', '/modules/processing-guide-v3.html'],
    ['/modules/embedding.html', '/modules/embedding-guide-v3.html'],
    ['/modules/staining.html', '/modules/staining-he-guide.html'],
  ];

  for (const [legacyPath, currentPath] of redirects) {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(new RegExp(`${currentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  }
});

test('custom 404 page renders and offers recovery links', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not available');
  await expect(page.getByRole('link', { name: 'Browse modules' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report a broken link' })).toHaveAttribute('href', 'contact.html');
});
