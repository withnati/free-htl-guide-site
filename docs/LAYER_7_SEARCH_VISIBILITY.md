# Layer 7 — Search Visibility, Sharing, and Live Deployment Verification

## Purpose

Layer 7 makes Free HTL Guide easier for search engines to understand, easier for learners to share, and easier to verify after a merge reaches GitHub Pages.

This layer does not promise indexing, ranking, rich results, or social-platform behavior. Search engines and social platforms make their own decisions. The implementation provides accurate, consistent signals and a controlled maintenance process.

## Public metadata architecture

`data/site-seo.json` is the source of truth for:

- canonical page paths and body page keys;
- Open Graph page type and section;
- breadcrumb trails;
- related-study links;
- whether a page displays sharing controls;
- the site URL, language, author, manifest, icon, and social image;
- the significant update date used by the sitemap.

`assets/seo.js` loads that file through the shared script chain and adds:

- `robots` preview directives;
- author and application metadata;
- Open Graph and Twitter card metadata;
- image size and alternative-text metadata;
- article section and modification metadata where applicable;
- the web manifest and scalable icon;
- `WebPage` or `ProfilePage` JSON-LD;
- `BreadcrumbList` JSON-LD;
- related-study links;
- native-share and copy-link controls.

Existing `LearningResource`, organization, author, item-list, and module authority schema remain in the established shared scripts. Layer 7 avoids fake ratings, review markup, unsupported pass-rate claims, and confidential examination content.

## Social preview behavior

The controlled social image is `assets/og-home.png` at 1200 × 630 pixels.

Pages with sharing enabled provide two actions:

- **Share** uses `share.html?p=<page-key>`. The bridge is `noindex` and contains static Open Graph/Twitter metadata, allowing a consistent preview even on platforms that do not execute JavaScript. A browser validates the page key against `data/site-seo.json` and redirects only to a controlled site page.
- **Copy link** copies the page’s direct canonical URL.

The bridge cannot redirect to arbitrary external URLs.

## Web app identity

`site.webmanifest` uses the GitHub Pages project prefix for `id`, `start_url`, and `scope`.

`assets/app-icon.svg` is a scalable site/app icon. The manifest references it with `sizes: any` and `purpose: any maskable`.

## Validation

Run locally from the repository root:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_site.py --root "$PWD"
python scripts/validate_authority.py --root "$PWD"
python scripts/validate_seo.py --root "$PWD"
npm run test:browser
```

`validate_seo.py` checks:

- the SEO JSON contract;
- exact agreement between sitemap pages and page keys;
- title and description length ranges;
- canonical URL consistency;
- sitemap `lastmod` freshness;
- related-page and breadcrumb integrity;
- the real PNG dimensions of the social image;
- manifest project-prefix settings;
- shared-loader activation;
- static metadata and `noindex` protection on the social bridge.

Browser tests confirm the rendered metadata, schemas, manifest/icon links, related resources, share/copy actions, and controlled redirect on desktop Chrome and Pixel 7.

## Live GitHub Pages verification

`.github/workflows/live-site-quality.yml` runs after a successful `Browser quality` push workflow on `main`.

The job:

1. checks out the exact tested commit with its parent;
2. identifies public files changed in that commit;
3. compares those files byte-for-byte with GitHub Pages;
4. retries while Pages/CDN propagation is pending;
5. fetches the live sitemap;
6. verifies that every canonical sitemap URL returns HTTP 200.

The job name is `Verify live deployment`. It is post-merge deployment evidence, not a pull-request gate.

## Google Search Console setup

No verification token is committed because Google generates it for the site owner.

1. Open Google Search Console.
2. Add a **URL-prefix property** for:

   `https://withnati.github.io/free-htl-guide-site/`

3. Choose an ownership method supported by the GitHub Pages project:
   - upload the exact Google verification HTML file to the repository root; or
   - add the exact Google verification meta tag to the homepage `<head>`.
4. Commit and deploy the verification value without changing it.
5. Complete verification in Search Console.
6. Open **Sitemaps** and submit:

   `https://withnati.github.io/free-htl-guide-site/sitemap.xml`

7. Use URL Inspection for the homepage and a representative module after the sitemap is processed.

Official documentation:

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## Bing Webmaster Tools setup

1. Open Bing Webmaster Tools.
2. Import the verified Google Search Console property, or add the site directly.
3. Use the exact project URL:

   `https://withnati.github.io/free-htl-guide-site/`

4. Complete ownership verification using the exact file or meta value Bing provides.
5. Submit:

   `https://withnati.github.io/free-htl-guide-site/sitemap.xml`

6. Review Site Explorer and URL Inspection after processing.

Official documentation:

- https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b
- https://www.bing.com/webmasters/help/Sitemaps-3b5cf6ed

IndexNow is not enabled in this layer because it requires a controlled key and an intentional submission workflow.

## Maintenance rules

When an indexable page is added, removed, renamed, or meaningfully changed:

1. update its HTML title, description, canonical, and `data-page` key;
2. update `data/site-seo.json`;
3. update `sitemap.xml` and use the date of the significant change;
4. preserve only canonical, indexable URLs in the sitemap;
5. keep redirect, thank-you, unsubscribe, and sharing utility pages out of the sitemap;
6. run all validators and browser tests;
7. update the editorial corrections log when the change affects content authority or conclusions.

Do not add fabricated ratings, review counts, official-endorsement claims, pass-rate promises, or schema that is not supported by visible page content.
