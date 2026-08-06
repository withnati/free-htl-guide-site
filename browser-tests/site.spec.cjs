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
  page.on('pageerror', (error) => problems.push(`Page error: ${error.message}`));
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

test('desktop navigation opens the complete public Fixation lesson', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/');
  await page.getByRole('link', { name: 'Start the free Fixation lesson' }).first().click();
  await expect(page).toHaveURL(/\/modules\/fixation-guide-v3\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Fixation' })).toBeVisible();
});

test('mobile menu opens, updates ARIA, and navigates to the HT/HTL course', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
  await page.locator('#mobileMenu').getByRole('link', { name: 'Course' }).click();
  await expect(page).toHaveURL(/\/#modules$/);
  await expect(page.locator('#modules')).toBeVisible();
  await expect(page.locator('#modules').getByRole('heading', { level: 2 })).toContainText(/major exam domains/i);
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

test('dark theme links, keyboard focus, and reduced motion remain accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('htl-theme', 'dark'));
  await page.reload();

  const accessibilityStyles = await page.evaluate(() => {
    const link = document.querySelector('.feature-card a');
    const button = document.querySelector('.hero-actions .btn');
    button.focus();
    const linkStyle = getComputedStyle(link);
    const buttonStyle = getComputedStyle(button);
    const bodyStyle = getComputedStyle(document.body);
    return {
      background: bodyStyle.backgroundColor,
      linkColor: linkStyle.color,
      outlineStyle: buttonStyle.outlineStyle,
      outlineWidth: buttonStyle.outlineWidth,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });

  function luminance(color) {
    const channels = color.match(/\d+/g).slice(0, 3).map((value) => Number(value) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const lighter = Math.max(luminance(accessibilityStyles.linkColor), luminance(accessibilityStyles.background));
  const darker = Math.min(luminance(accessibilityStyles.linkColor), luminance(accessibilityStyles.background));
  expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(accessibilityStyles.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(accessibilityStyles.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(accessibilityStyles.scrollBehavior).toBe('auto');
});

test('quiz grading and reset work in the browser', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/modules/fixation-guide-v3.html#quiz');
  const firstQuestion = page.locator('fieldset[data-correct]').first();
  const correctValue = await firstQuestion.getAttribute('data-correct');
  await firstQuestion.locator(`input[value="${correctValue}"]`).check();
  await page.locator('[data-grade]').click();
  await expect(page.locator('.quiz-result')).toContainText('Score: 1/10');
  await expect(page.locator('.quiz-result')).toContainText('Review each explanation');
  await expect(firstQuestion).toHaveClass(/correct/);
  await page.locator('[data-retry]').click();
  await expect(page.locator('.quiz-result')).toBeHidden();
  await expect(firstQuestion.locator('input:checked')).toHaveCount(0);
});

test('email signup requires consent and redirects after a mocked success', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  let submittedBody = '';
  await page.route('https://formspree.io/**', async (route) => {
    submittedBody = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
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

test('custom 404 page offers exam-preparation recovery links', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that study page');
  await expect(page.getByRole('link', { name: 'Start the free Fixation lesson' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the HT/HTL course' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report a broken link' })).toHaveAttribute('href', 'contact.html');
});

test('all modules render authority metadata and classify 70 questions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const moduleUrls = productionUrls.filter((url) => new URL(url).pathname.includes('/modules/'));
  let totalQuestions = 0;
  expect(moduleUrls).toHaveLength(7);

  for (const productionUrl of moduleUrls) {
    const urlPath = localPath(productionUrl);
    await page.goto(urlPath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-authority-loaded', 'true');
    await expect(page.locator('#authority')).toBeVisible();
    await expect(page.locator('.hero-card .status')).toContainText('v1.1.0');
    await expect(page.getByRole('link', { name: 'Official content guideline' })).toHaveAttribute('href', /^https:\/\//);
    await expect(page.getByRole('link', { name: 'Editorial standards and corrections' })).toBeVisible();
    const questions = page.locator('#quiz fieldset[data-difficulty]');
    await expect(questions).toHaveCount(10);
    await expect(page.locator('#quiz .difficulty')).toHaveCount(10);
    const difficulties = await questions.evaluateAll((items) => items.map((item) => item.dataset.difficulty));
    expect(difficulties.every((item) => ['Foundational', 'Application', 'Troubleshooting'].includes(item))).toBe(true);
    totalQuestions += difficulties.length;
  }
  expect(totalQuestions).toBe(70);
});
