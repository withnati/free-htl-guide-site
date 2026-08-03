# Free HTL Guide

Free HTL Guide is an HT/HTL learning and certification-preparation platform in active development. It combines structured histotechnology lessons, quizzes, mock exams, targeted practice, verified learner accounts, and cloud-backed progress.

The repository is at the V5.0 staging and sandbox checkpoint. Cloudflare preview deployment, protected-delivery containment, verified accounts, cloud progress, subscription lifecycle handling, and the Fixation runtime-question pilot are implemented and validated. This is not approval for a production cutover or live billing.

## Product direction

The project is transitioning from a static study guide into a subscription learning platform.

- **Public launch content:** homepage, instructor and editorial information, course outline, the complete Fixation lesson, selected sample questions, limited study resources, feature previews, pricing, and signup.
- **Free account experience:** verified identity, basic cloud progress, cross-device continuity for free learning, account settings, progress export/reset, and account deletion.
- **Premium experience:** lessons 2–7, full quizzes, the complete question bank, mock exams, Targeted Practice, detailed explanations, advanced history, weak-domain recommendations, and future premium learning tools.

Authentication proves identity only. Browser metadata, profile fields, URL parameters, or local storage may not grant premium access. Protected content must be authorized by a server before delivery.

## Current architecture

### Completed account, progress, and protected-delivery foundation

- Static frontend currently deployed through GitHub Pages during development
- Supabase Auth with signup, email verification, sign-in, sign-out, recovery, and password reset
- Controlled authentication callbacks using PKCE
- Versioned learner-progress record and central progress-service contract
- Anonymous local-browser progress
- Explicit anonymous-to-account progress import or account-only mode
- Normalized PostgreSQL cloud progress across ten relational tables
- Row Level Security and two-user ownership tests
- Cross-device synchronization
- Offline pending-write recovery
- Revision-based conflict protection for mutable sessions
- Stable and idempotent completed attempts
- Secure account deletion through a Supabase Edge Function
- Privacy-first, consent-gated analytics
- Automated Site, Browser, and Database Quality workflows

### Implemented staging architecture

- Cloudflare Pages for previews, production hosting, custom domains, TLS, security headers, and rollback
- Supabase Auth for learner identity
- Supabase PostgreSQL for learner progress and server-controlled entitlement records
- Supabase Edge Functions for authenticated entitlement checks
- Private Supabase Storage for protected lessons, question payloads, explanations, answer keys, and downloads
- Stripe sandbox billing with server-controlled entitlement updates and lifecycle reconciliation

## Current development status

- Layers 1–16.9 represented by the V5.0 checkpoint are merged into `main`.
- Layer 12 Targeted Practice merged through PR #17 as `a130066847650988181e1d0c452f920bb7cf252b`.
- Layer 13 authentication and cloud progress merged through PR #18 as `405686a2193282d246d2c2878b9bafb015617aea`.
- Layer 14 hosting and protected delivery, Layer 15 subscription architecture/UX, and the Layer 16 question-runtime and sandbox-billing work are implemented on `main`.
- Staging uses Cloudflare previews, Supabase staging services, and payment-provider sandbox/test mode only.
- Live billing, production data/services, the canonical production domain, final legal/tax/refund wording, and production deployment remain owner-controlled launch gates.

The 150-record development bank contains 70 authority-reviewed base questions and 80 alternate scenarios that still require final manual scientific and editorial review.

## Layer 14 security boundary

The public browser may receive public pages, free learning content, account interfaces, upgrade states, and non-sensitive content identifiers.

The browser must not receive premium lesson payloads, full question banks, explanations, answer keys, or protected downloads unless a server or Edge Function has:

1. validated the Supabase session;
2. derived the user from the verified token;
3. checked a server-controlled entitlement;
4. validated the requested content identifier; and
5. authorized delivery from private storage.

Existing public premium-designated material is treated as development-preview content. Revised or newly created launch-premium content must remain private from creation onward.

## Allowlisted public deployment

Production hosting must deploy the generated `dist/` directory, never the repository root.

The public build:

- copies only approved public and account-shell files;
- keeps the complete Fixation lesson as the public acquisition hook;
- replaces premium lesson, practice, mock-exam, and Targeted Practice routes with noindex preview shells;
- excludes premium question-bank JSON, explanations, answer-key material, server code, migrations, tests, documentation, and unapproved downloads;
- generates environment-specific browser-safe Supabase configuration;
- generates the approved sitemap, robots file, and Cloudflare `_headers` rules;
- scans the output for protected paths, question-bank identifiers, credentials, and premium leakage.

Build and validate a local preview:

```bash
npm run build:public
npm run validate:public-build
```

For staging and production, set explicit browser-safe values before building:

```bash
FHL_ENVIRONMENT=staging \
FHL_PUBLIC_SITE_URL=https://staging.example.test/ \
FHL_SUPABASE_URL=https://example-project.supabase.co \
FHL_SUPABASE_PUBLISHABLE_KEY=replace-with-browser-safe-publishable-key \
npm run build:public

npm run validate:public-build
```

Do not place a service-role key, database password, secret key, deployment token, signing secret, or payment secret in the build environment or frontend configuration.

Cloudflare Pages target configuration:

- build command: `npm run build:public && npm run validate:public-build`
- output directory: `dist`
- repository root is not a deployable output directory

## Local validation

Run static and contract checks:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_site.py --root .
python scripts/validate_authority.py --root .
python scripts/validate_mock_exam.py --root .
python scripts/validate_seo.py --root .
python scripts/validate_analytics.py --root .
python scripts/validate_progress.py --root .
python scripts/validate_targeted_practice.py --root .
python scripts/validate_cloud_progress.py --root .
python scripts/validate_auth.py --root .
python scripts/validate_cloud_adapter.py --root .
python scripts/validate_layer14_security.py --root .
```

Run database checks with the Supabase CLI:

```bash
supabase db start
supabase db lint --level warning --fail-on error
supabase test db
supabase stop --no-backup
```

Run browser tests:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm run test:browser
```

The committed `package-lock.json` and Browser Quality workflow use deterministic `npm ci` installation.

## Key project documents

- `docs/ROADMAP.md`
- `docs/LAYER_11_ACCOUNT_READY_PROGRESS.md`
- `docs/LAYER_12_TARGETED_PRACTICE.md`
- `docs/LAYER_13_AUTH_CLOUD_PROGRESS.md`
- `docs/LAYER_13_SUPABASE_SETUP.md`
- `docs/LAYER_14_ARCHITECTURE_DECISION.md`
- `docs/LAYER_14_ENVIRONMENT_PLAN.md`
- `docs/LAYER_14_CONTENT_BOUNDARY.md`
- `docs/LAYER_14_ENTITLEMENTS_AND_PROOF.md`
- `docs/LAYER_14_OPERATIONS.md`
- `docs/LIVE_BILLING_LAUNCH_READINESS.md`
- `docs/LAYER_16_INTEGRATION_STATUS.md`
- `docs/WHOLE_PRODUCT_REASSESSMENT_2026-08-03.md`
- `data/content-access.json`
- `data/progress-schema.json`
- `data/question-bank-manifest.json`
- `editorial.html`
- `privacy.html`
- `terms.html`

## Repository workflow

Major product layers are developed on dedicated branches and opened as draft pull requests. A layer must not be merged until its automated workflows pass, its security boundaries are reviewed, desktop and mobile behavior is verified, staging evidence is complete, and explicit merge approval is given.

Every focused PR must remain unmerged until its applicable Site, Browser, Database, protected-delivery, public-build, and preview checks pass on the exact head SHA. Production deployment and live billing additionally require the owner-controlled gates in `docs/LIVE_BILLING_LAUNCH_READINESS.md`.
