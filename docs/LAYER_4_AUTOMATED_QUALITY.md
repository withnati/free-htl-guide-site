# Layer 4 — Automated Quality Protection

This layer adds a read-only GitHub Actions workflow that validates the static site on every pull request to `main`, every push to `main`, and manual workflow runs.

## Workflow

Workflow file:

`.github/workflows/site-quality.yml`

The workflow uses official GitHub actions and grants only:

```yaml
permissions:
  contents: read
```

It does not deploy the site, modify repository content, access secrets, or submit visitor data.

## Checks performed

### Repository-owned site validator

Run locally from the repository root on macOS or Linux with:

```bash
python scripts/validate_site.py --root "$(pwd)"
```

Using the absolute repository path also makes the success message report the validated HTML page count correctly.

The validator checks:

- every HTML page has an HTML5 doctype
- every HTML page has a language, non-empty title, one H1, and canonical URL
- duplicate HTML IDs
- malformed nesting of required closing tags
- invalid static JSON-LD blocks
- local links and asset references in HTML
- local fragment links such as `page.html#section`
- local `url(...)` and `@import` references in CSS
- files referenced by pages actually exist with matching letter case
- root-relative URLs use the GitHub Pages project prefix
- sitemap XML validity
- duplicate sitemap entries
- sitemap `lastmod` date format
- sitemap URLs point to existing canonical HTML pages
- indexable canonical pages appear in the sitemap
- no-index pages do not appear in the sitemap
- `robots.txt` identifies the crawler and production sitemap

External websites are intentionally not requested during CI. That avoids flaky failures caused by rate limits, temporary outages, bot blocking, or remote redirects. The workflow protects internal navigation and repository-owned assets.

### JavaScript syntax

Every repository JavaScript file is checked with:

```bash
node --check path/to/file.js
```

The workflow uses Node.js 24.

### Validator regression tests

The validator has unit tests covering:

- a valid site
- missing local files
- missing fragment targets
- duplicate IDs
- indexable pages missing from the sitemap
- no-index pages incorrectly placed in the sitemap
- missing CSS assets

Run them locally with:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

## GitHub annotations

Validation errors use GitHub workflow annotations. A failed run links the error to the affected file and line whenever the source location is available.

## Dependabot

`.github/dependabot.yml` checks monthly for updates to GitHub Actions dependencies. It is limited to three open action-update pull requests.

## Recommended branch protection after merge

In the repository settings:

1. Open **Settings → Branches** or **Rules → Rulesets**.
2. Create a rule for `main`.
3. Require a pull request before merging.
4. Require the status check named **Validate static site**.
5. Require branches to be up to date before merging when practical.
6. Do not require deployment jobs because this workflow validates only.

The status check can be selected only after the workflow has completed at least once.

## Adding new pages

For a normal public page:

1. Add a canonical URL matching the production path.
2. Add exactly one H1.
3. Add the page to `sitemap.xml` with an ISO `YYYY-MM-DD` last-modified date.
4. Run the validator locally.

For a utility page that should not appear in search results:

1. Add `<meta name="robots" content="noindex,follow">`.
2. Keep the page out of `sitemap.xml`.
3. It may still have a canonical URL and internal links.

## Legacy redirects

Old public module URLs remain in the repository as direct redirects to the current reviewed modules. Each redirect includes:

- a no-index directive
- the current absolute canonical URL
- a direct meta refresh
- a JavaScript redirect that preserves the URL fragment
- an accessible H1 and manual fallback link

This prevents broken bookmarks without leaving outdated lesson copies publicly available.

## Current boundaries

The workflow does not evaluate the scientific accuracy of lesson content, test remote links, run browser rendering, or perform visual-regression testing. Those can be added as later quality layers if needed.
