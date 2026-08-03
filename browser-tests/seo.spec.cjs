const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');
const seoData = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data', 'site-seo.json'), 'utf8'));
const sitemap = fs.readFileSync(path.join(repositoryRoot, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const prefix = new URL(seoData.site.url).pathname.replace(/\/$/, '');

function localRoute(absoluteUrl) {
  const url = new URL(absoluteUrl);
  const route = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
  return route || '/';
}

for (const absoluteUrl of sitemapUrls) {
  const route = localRoute(absoluteUrl);
  test(`${route} renders controlled search and sharing metadata`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });

    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toHaveAttribute('data-seo-loaded', 'true');

    const pageKey = await page.locator('body').getAttribute('data-page');
    const metadata = seoData.pages[pageKey];
    expect(metadata).toBeTruthy();

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(absoluteUrl);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /max-image-preview:large/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S+/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S+/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', absoluteUrl);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${seoData.site.url}${seoData.site.defaultImage}`
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      `${seoData.site.url}${seoData.site.defaultImage}`
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/site\.webmanifest$/);
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
      'href',
      /\/assets\/app-icon\.svg$/
    );

    const pageSchema = JSON.parse(await page.locator('#free-htl-page-schema').textContent());
    expect(pageSchema.url).toBe(absoluteUrl);
    expect(pageSchema.primaryImageOfPage.width).toBe(1200);
    const breadcrumbSchema = JSON.parse(await page.locator('#free-htl-breadcrumb-schema').textContent());
    expect(breadcrumbSchema.itemListElement).toHaveLength(metadata.breadcrumbs.length);

    if (metadata.share) {
      await expect(page.locator('[data-seo-share]')).toBeVisible();
    } else {
      await expect(page.locator('[data-seo-share]')).toHaveCount(0);
    }

    if (pageKey === 'home') {
      await expect(page.locator('[data-seo-related]')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-seo-related] a')).toHaveCount(metadata.related.length);
    }

    expect(pageErrors).toEqual([]);
  });
}

test('share and copy controls use safe controlled URLs', async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedSeoUrl = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(value) {
          window.__copiedSeoUrl = value;
          return Promise.resolve();
        }
      }
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });

  await page.goto('/modules/fixation-guide-v3.html', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toHaveAttribute('data-seo-loaded', 'true');

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.locator('.seo-share-status')).toHaveText('Direct link copied.');
  expect(await page.evaluate(() => window.__copiedSeoUrl)).toBe(
    'https://withnati.github.io/free-htl-guide-site/modules/fixation-guide-v3.html'
  );

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('.seo-share-status')).toHaveText('Share-preview link copied.');
  const sameOriginShareUrl = new URL('/share.html?p=fixation-v3', page.url()).href;
  expect(await page.evaluate(() => window.__copiedSeoUrl)).toBe(sameOriginShareUrl);
});

test('static share bridge redirects only to a known controlled page', async ({ page }) => {
  await page.goto('/share.html?p=fixation-v3');
  await page.waitForURL('**/modules/fixation-guide-v3.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fixation');
});
