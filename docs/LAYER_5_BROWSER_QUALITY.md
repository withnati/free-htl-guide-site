# Layer 5 — Browser-Level Quality Protection

Layer 5 renders Free HTL Guide in a real Chromium browser on every pull request to `main`, every push to `main`, and manual workflow runs.

Layer 4 validates source files. Layer 5 validates what visitors actually experience after HTML, CSS, JavaScript, browser storage, responsive rules, redirects, and form behavior are combined.

## Workflow

Workflow file:

`.github/workflows/browser-quality.yml`

The job name is:

`Browser smoke tests`

The workflow grants only:

```yaml
permissions:
  contents: read
```

It does not deploy the website, submit a real email address, access repository secrets, or change Formspree data.

## Browser coverage

The current suite uses Chromium in two projects:

- desktop Chrome profile
- Pixel 7 mobile profile

The CI workflow installs only Chromium to reduce download time and improve stability. Playwright runs with one worker in CI and retains traces, screenshots, and videos when a test fails.

## Checks performed

### Sitemap-driven rendering sweep

Every canonical URL in `sitemap.xml` is rendered on desktop and mobile. Each page must:

- return a successful local HTTP response
- contain exactly one visible H1
- produce no uncaught JavaScript errors
- produce no browser console errors
- load all local images successfully
- avoid horizontal page overflow

Because the page list comes from the sitemap, adding a public canonical page automatically adds it to the browser sweep.

### Focused interaction checks

The suite also verifies:

- desktop navigation opens the current Fixation module
- the mobile menu becomes visible and updates `aria-expanded`
- dark mode persists after a reload
- study-plan task completion persists in local storage
- quiz grading displays the correct score and reset clears the attempt
- email signup requires consent
- email signup contains one copy of each hidden metadata field
- a mocked successful Formspree response redirects to the thank-you page
- no real Formspree submission is made during testing
- legacy module URLs redirect directly to current reviewed guides
- the custom 404 page offers working recovery links

## Local setup

From the repository root:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

For a visible browser window:

```bash
npm run test:browser:headed
```

To open the most recent HTML report:

```bash
npm run test:browser:report
```

The Playwright dependency is pinned to an exact version in `package.json`. Dependabot checks npm dependencies monthly.

## CI evidence

The workflow uploads a `browser-quality-report` artifact for completed runs. It may contain:

- the Playwright HTML report
- failure screenshots
- retained browser traces
- retained videos

Artifacts are retained for 14 days.

## Required status checks

The connected GitHub tool can edit repository content and pull requests, but it does not expose repository ruleset mutations. The required checks must therefore be selected once in the GitHub settings UI.

After this layer has completed successfully at least once:

1. Open the repository on GitHub.
2. Select **Settings**.
3. Open **Rules → Rulesets**.
4. Create or edit a branch ruleset targeting `main`.
5. Enable **Require a pull request before merging**.
6. Enable **Require status checks to pass**.
7. Add **Validate static site**.
8. Add **Browser smoke tests**.
9. Enable **Require branches to be up to date before merging** when practical.
10. Set enforcement to **Active** and save.

GitHub identifies workflow-required checks by the job name, not the workflow-file name.

## Current boundaries

Layer 5 does not:

- compare screenshots pixel by pixel
- evaluate WCAG compliance with a full accessibility engine
- test remote third-party websites
- send a real subscription request
- test multiple desktop browser engines
- verify scientific accuracy

Those protections can be added later without weakening the current fast smoke-test gate.
