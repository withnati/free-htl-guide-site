# Free HTL Guide

Free HTL Guide is an HT/HTL learning and certification-preparation platform in active development. It combines structured histotechnology lessons, quizzes, mock exams, targeted practice, verified learner accounts, cloud-backed progress, protected Premium delivery, and subscription access.

The repository has advanced beyond the V5.0 staging/sandbox checkpoint. The current post-V5 baseline includes an entitlement-aware Premium learner shell, a secure Premium learning library, protected Processing and Embedding lessons, an account-linked six-week study plan, stronger Premium recovery/offline states, improved accessibility and mobile consent behavior, and repeatable authenticated staging smoke coverage. This is still not approval for a production cutover or live billing.

See `docs/POST_V5_RECONCILIATION_2026-08-06.md` for the reconciled current-state record.

## Product direction

The project is transitioning from a static study guide into a subscription learning platform.

- **Public launch content:** homepage, instructor and editorial information, course outline, the complete Fixation lesson, selected sample questions, limited study resources, feature previews, pricing, and signup.
- **Free account experience:** verified identity, basic cloud progress, cross-device continuity for free learning, account settings, progress export/reset, and account deletion.
- **Premium experience:** progressively released protected lessons and study tools, with the future scope including lessons 2–7, full quizzes, the complete reviewed question bank, mock exams, Targeted Practice, detailed explanations, advanced history, weak-domain recommendations, and future Premium learning tools.

Authentication proves identity only. Browser metadata, profile fields, URL parameters, or local storage may not grant Premium access. Protected content must be authorized by a server before delivery.

## Current learner experience

### Available publicly

- Complete Fixation lesson.
- Approved public Fixation sample-question runtime.
- Course outline and Premium previews.
- Pricing, signup, editorial/trust information, privacy, terms, and FAQ.
- Anonymous local progress for the free experience.

### Available now with confirmed Premium access

- Processing and Decalcification protected lesson.
- Embedding and Microtomy protected lesson.
- Six-week HT/HTL study plan with 35 account-linked tasks.
- Premium learning library.
- Entitlement-aware dashboard guidance and release-status presentation.

### Included in the Premium roadmap but not yet released for secure study

- Routine H&E Staining.
- Special Stains.
- Laboratory Operations.
- IHC/ISH Fundamentals.
- Full Premium quizzes.
- Mixed-domain cumulative practice.
- Full mock-exam release.
- Targeted Practice release.
- Protected downloads and additional Premium tools.

Learner-facing pages must distinguish these future releases from experiences that are actually available now.

## Current architecture

### Account, progress, and protected-delivery foundation

- Supabase Auth with signup, email verification, sign-in, sign-out, recovery, and password reset.
- Controlled authentication callbacks using PKCE.
- Versioned learner-progress record and central progress-service contract.
- Anonymous local-browser progress.
- Explicit anonymous-to-account progress import or account-only mode.
- Normalized PostgreSQL cloud progress across ten relational tables.
- Row Level Security and two-user ownership tests.
- Cross-device synchronization.
- Offline pending-write recovery.
- Revision-based conflict protection for mutable sessions.
- Stable and idempotent completed attempts.
- Secure account deletion through a Supabase Edge Function.
- Privacy-first, consent-gated analytics.
- Automated Site, Browser, Database, and protected-delivery workflows.

### Implemented staging architecture

- Cloudflare Pages for generated allowlisted deployment, previews, production hosting, custom domains, TLS, security headers, and rollback.
- Supabase Auth for learner identity.
- Supabase PostgreSQL for learner progress and server-controlled entitlement records.
- Supabase Edge Functions for authenticated entitlement checks.
- Private Supabase Storage for protected lessons and future protected question/explanation/download payloads.
- Stripe sandbox billing with server-controlled entitlement updates and lifecycle reconciliation.
- Authenticated staging Premium smoke coverage using encrypted test-account secrets and credential-safe artifact settings.

### Current protected-content allowlist

The Premium delivery function currently recognizes:

- `processing-proof-v1`
- `study-plan-v1`
- `embedding-microtomy-v1`

For every protected request, the server validates the origin and session, derives the learner from the verified token, maps the content ID through a server allowlist, checks effective `fhl-premium` entitlement, and only then reads the private object.

## Current development status

- V5.0 remains the historical staging deployment and sandbox billing checkpoint.
- The reconciled post-V5 main baseline is recorded in `docs/POST_V5_RECONCILIATION_2026-08-06.md`.
- Current reconciled `main` before that documentation branch: `e9a101bedb07aa65c6ff428a1f92dcf4f1fe1755`.
- PRs #46–#64 added reliability, accessibility, Premium learner UX, protected study-plan delivery, staging Premium smoke coverage, truthful availability copy, and the protected Embedding and Microtomy lesson.
- The exact PR #64 head passed Site quality, Browser quality, Database quality, and Layer 14 security before merge.
- Live billing, production data/services, the canonical production domain, final legal/tax/refund wording, and production deployment remain owner-controlled launch gates.

The 150-record development bank contains 70 authority-reviewed base questions and 80 alternate scenarios that still require final manual scientific and editorial review.

## Layer 14 security boundary

The public browser may receive public pages, free learning content, account interfaces, upgrade states, and non-sensitive content identifiers.

The browser must not receive protected Premium lesson payloads, full question banks, explanations, answer keys, or protected downloads unless a server or Edge Function has:

1. validated the Supabase session;
2. derived the user from the verified token;
3. checked a server-controlled entitlement;
4. validated the requested content identifier; and
5. authorized delivery from private storage.

Existing public Premium-designated material is treated as development-preview content. Revised or newly created launch-Premium content must remain private from creation onward.

## Allowlisted public deployment

Production hosting must deploy the generated `dist/` directory, never the repository root.

The public build:

- copies only approved public and account-shell files;
- keeps the complete Fixation lesson as the public acquisition hook;
- replaces unreleased Premium lesson, practice, mock-exam, and Targeted Practice routes with noindex preview shells;
- includes only the protected-shell code needed to request authorized content and never embeds the private lesson payload itself;
- excludes Premium question-bank JSON, explanations, answer-key material, server code, migrations, tests, documentation, and unapproved downloads;
- generates environment-specific browser-safe Supabase configuration;
- generates the approved sitemap, robots file, and Cloudflare `_headers` rules;
- scans the output for protected paths, question-bank identifiers, credentials, and Premium leakage.

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

- `docs/POST_V5_RECONCILIATION_2026-08-06.md`
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

Major product work is developed on focused branches and reviewed through pull requests. A change must not be merged until its applicable automated workflows pass, its security boundaries are reviewed, desktop/mobile behavior is verified when relevant, staging evidence is complete when relevant, and the exact head SHA is confirmed.

Every focused PR must remain unmerged until its applicable Site, Browser, Database, protected-delivery, public-build, and preview checks pass on the exact head SHA. Production deployment and live billing additionally require the owner-controlled gates in `docs/LIVE_BILLING_LAUNCH_READINESS.md`.
