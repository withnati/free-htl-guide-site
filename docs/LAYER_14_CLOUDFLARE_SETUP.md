# Layer 14 Cloudflare Pages Setup

**Status:** Configuration plan only — no Cloudflare project, domain, or production deployment has been created by this document.  
**Approved hosting architecture:** Cloudflare Pages frontend with Supabase Auth, PostgreSQL, Edge Functions, and private Storage.

## Purpose

This runbook converts the approved Layer 14 architecture into a controlled Cloudflare Pages configuration. It assumes the repository-side public build and leakage validation are green before Git integration is enabled.

The Cloudflare project must deploy `dist/`, not the repository root. Deploying the repository root would expose server code, migrations, tests, documentation, development question files, and premium-designated source material.

## Prerequisites requiring owner involvement

Before creating the project:

- [ ] Confirm the Cloudflare account that will own production hosting.
- [ ] Confirm repository visibility and GitHub integration permissions.
- [ ] Select the production domain or subdomain.
- [ ] Select the staging hostname strategy.
- [ ] Approve the staging Supabase project.
- [ ] Approve creation of a separate production Supabase project.
- [ ] Confirm who may administer Cloudflare production settings.

Do not send Cloudflare API tokens, Supabase secret keys, database passwords, or deployment credentials through chat, GitHub issues, screenshots, or committed files.

## Recommended project structure

Use one Cloudflare Pages project with:

- a production deployment from `main` only after Layer 14 approval;
- preview deployments for pull requests and approved branches;
- a controlled staging alias or staging custom domain;
- production environment variables separated from preview variables;
- access restrictions on preview deployments where practical;
- `dist` as the only output directory.

A separate staging Pages project is acceptable if it materially simplifies access control or environment isolation, but it adds configuration duplication. The initial recommendation is one Pages project with protected previews and an explicit staging hostname.

## Git integration

1. Connect Cloudflare Pages to the approved GitHub account.
2. Select `withnati/free-htl-guide-site`.
3. Limit installation access to the required repository where possible.
4. Do not grant broader organization or repository access than needed.
5. Confirm the production branch is not enabled until the staging proof is ready.
6. Confirm preview deployments are enabled for the Layer 14 branch and pull requests.

Changing the repository to private before revised launch-premium source is added remains recommended. Historical public content cannot be made secret retroactively.

## Build configuration

Use:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `npm run build:public && npm run validate:public-build` |
| Build output directory | `dist` |
| Node version | `24` if Cloudflare requires an explicit Node version for npm scripts |
| Production branch | `main`, only after approval |

The build scripts use Python. Confirm the Cloudflare build image includes a supported Python 3 runtime. If not, use an explicit supported build image or a GitHub Actions deployment workflow that uploads the already validated `dist/` artifact. Do not bypass validation by manually uploading the repository root.

## Preview environment variables

Set browser-safe values only:

```text
FHL_ENVIRONMENT=staging
FHL_PUBLIC_SITE_URL=https://<controlled-staging-hostname>/
FHL_SUPABASE_URL=https://<staging-project-ref>.supabase.co
FHL_SUPABASE_PUBLISHABLE_KEY=<staging-browser-safe-publishable-key>
```

Optional consent-gated analytics variables may remain blank during the protected proof.

Preview variables must never contain:

- Supabase service-role or secret keys;
- database passwords or privileged connection strings;
- Cloudflare API tokens;
- payment-provider secret keys;
- payment webhook signing secrets;
- private content payloads;
- staging test-account passwords.

## Production environment variables

Set only after production approval:

```text
FHL_ENVIRONMENT=production
FHL_PUBLIC_SITE_URL=https://<production-domain>/
FHL_SUPABASE_URL=https://<production-project-ref>.supabase.co
FHL_SUPABASE_PUBLISHABLE_KEY=<production-browser-safe-publishable-key>
```

Production build validation intentionally fails if these values are omitted. It must not silently use the development Supabase project or GitHub Pages URL.

## Preview access and indexing

Cloudflare preview deployments should be treated as controlled review environments.

Recommended controls:

- protect preview hostnames with Cloudflare Access when available;
- restrict access to the repository owner and approved reviewers;
- do not send preview URLs to learners;
- retain the build-generated `X-Robots-Tag: noindex, nofollow` header;
- keep account, premium proof, and premium preview pages `noindex,nofollow` in HTML;
- do not add preview URLs to production Supabase redirect allowlists.

If Cloudflare-generated preview URLs must be used for Supabase Auth testing, allow only the exact required preview URLs in the staging Supabase project. Avoid broad production wildcards.

## Custom domains and TLS

### Staging

Recommended pattern:

```text
staging.<production-domain>
```

An alternate controlled hostname may be used if DNS ownership or access controls require it.

### Production

Use a dedicated FHL domain or subdomain. Do not use the shared `withnati.github.io` origin for the final authenticated production experience.

After domain connection:

1. Verify DNS ownership.
2. Verify TLS issuance and renewal.
3. Confirm HTTP redirects to HTTPS.
4. Confirm canonical URLs use the production domain.
5. Confirm Supabase callbacks use the exact production domain.
6. Confirm account storage is isolated on the dedicated origin.
7. Enable HSTS only after HTTPS and rollback behavior are verified.

## Security headers

The allowlisted build generates `dist/_headers` with:

- Content Security Policy;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- frame protection;
- noindex headers for account, proof, and premium preview routes;
- no-store caching for account and premium routes.

After the first Cloudflare preview:

- inspect response headers directly;
- confirm Cloudflare did not drop or override required headers;
- confirm CSP does not block Supabase Auth or approved frontend assets;
- confirm no permissive CORS header is added to static pages;
- confirm CDN caching does not store account or premium responses.

The premium Edge Function maintains its own separate security and CORS headers.

## Build and deployment verification

For each Cloudflare preview:

- [ ] Deployment references the expected commit SHA.
- [ ] Build command ran both build and validation.
- [ ] Output directory is `dist`.
- [ ] `build-manifest.json` exists.
- [ ] Premium source lessons are replaced by preview shells.
- [ ] Question-variant JSON is absent.
- [ ] Mock-exam blueprint and extension manifest are absent.
- [ ] Supabase service-role and secret keys are absent.
- [ ] Server code, migrations, tests, and docs are absent.
- [ ] Only approved Fixation downloads are public.
- [ ] Account pages use staging Supabase public configuration.
- [ ] Canonical URLs use the staging hostname.
- [ ] Preview pages return noindex headers.
- [ ] Mobile and desktop rendering are reviewed.

## Supabase staging coordination

Before testing Auth on the Cloudflare preview:

1. Add the controlled staging site URL to the staging Supabase Auth site configuration.
2. Add exact staging callback and password-reset URLs.
3. Add the exact staging origin to `FHL_ALLOWED_ORIGINS` for the `premium-content` and `delete-account` functions.
4. Remove RawGitHack from staging after the Cloudflare flow works.
5. Keep production callbacks absent from the staging project.
6. Use designated staging accounts only.

## Deployment rollback

Cloudflare frontend rollback is independent from Supabase rollback.

Frontend rollback procedure:

1. Identify the last known-good Pages deployment and commit SHA.
2. Promote or redeploy that artifact.
3. Confirm the production/staging domain points to the rollback deployment.
4. Re-run public, account, callback, and protected-entry smoke tests.
5. Record the rollback deployment ID and reason.

A frontend rollback does not undo database migrations, Edge Functions, entitlements, or private content. Follow `docs/LAYER_14_OPERATIONS.md` for those components.

## GitHub Pages transition

Do not immediately disable the existing GitHub Pages deployment when the first Cloudflare preview is created.

Recommended transition:

1. Keep GitHub Pages as a development rollback reference.
2. Complete Cloudflare staging verification.
3. Complete staging Supabase callback, progress, account deletion, and protected-delivery tests.
4. Approve the production domain and production Supabase project.
5. Deploy production and run smoke tests.
6. Stop directing learners to GitHub Pages.
7. Remove GitHub Pages and RawGitHack from production callback and CORS allowlists.
8. Decide whether to disable GitHub Pages or retain a static redirect after the rollback period.

The old GitHub Pages content remains historically public and must not be treated as protected premium content.

## Cloudflare logs and monitoring

At minimum, retain access to:

- deployment history and status;
- build logs;
- custom-domain and TLS status;
- rollback controls;
- request/security events available under the selected plan;
- configuration change history where available.

Do not rely on Cloudflare static request logs for entitlement auditing. Entitlement decisions occur in Supabase and should be reviewed through protected-function logs and entitlement event history.

## Current execution boundary

The next external step requires owner participation to choose or access:

- the Cloudflare account;
- repository integration permissions;
- production domain;
- staging hostname;
- staging and production Supabase projects.

Until then, repository build, security, browser, database, and documentation work may continue without creating external resources.
