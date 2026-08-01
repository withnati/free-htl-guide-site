# Free HTL Guide

Free HTL Guide is an HT/HTL learning and certification-preparation platform in active development. It combines structured histotechnology lessons, quizzes, mock exams, targeted practice, verified learner accounts, and cloud-backed progress.

The current public GitHub Pages deployment remains a development preview. Premium-designated content is still publicly retrievable in the static repository and deployment and must not be treated as securely protected until Layer 14 is complete.

## Product direction

The project is transitioning from a static study guide into a subscription learning platform.

- **Public launch content:** homepage, instructor and editorial information, course outline, the complete Fixation lesson, selected sample questions, limited study resources, feature previews, pricing, and signup.
- **Free account experience:** verified identity, basic cloud progress, cross-device continuity for free learning, account settings, progress export/reset, and account deletion.
- **Premium experience:** lessons 2–7, full quizzes, the complete question bank, mock exams, Targeted Practice, detailed explanations, advanced history, weak-domain recommendations, and future premium learning tools.

Authentication proves identity only. Browser metadata, profile fields, URL parameters, or local storage may not grant premium access. Protected content must be authorized by a server before delivery.

## Current architecture

### Completed Layer 13 foundation

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

### Approved Layer 14 architecture

- Cloudflare Pages for previews, production hosting, custom domains, TLS, security headers, and rollback
- Supabase Auth for learner identity
- Supabase PostgreSQL for learner progress and server-controlled entitlement records
- Supabase Edge Functions for authenticated entitlement checks
- Private Supabase Storage for protected lessons, question payloads, explanations, answer keys, and downloads
- Stripe or another approved payment provider later in Layer 15

## Current development status

- Layers 1–13 are complete and merged into `main`.
- Layer 12 Targeted Practice merged through PR #17 as `a130066847650988181e1d0c452f920bb7cf252b`.
- Layer 13 authentication and cloud progress merged through PR #18 as `405686a2193282d246d2c2878b9bafb015617aea`.
- Layer 14 production hosting and protected delivery is active in draft PR #19 on `layer-14-production-protected-delivery`.
- Layer 15 will connect payment-provider state to server-controlled entitlements.
- Layer 16 will complete the launch funnel, conversion path, and product optimization.

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
npm install --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm run test:browser
```

A committed dependency lockfile and conversion from `npm install` to deterministic `npm ci` remain an active repository-maintenance item in Layer 14.

## Key project documents

- `docs/ROADMAP.md`
- `docs/LAYER_11_ACCOUNT_READY_PROGRESS.md`
- `docs/LAYER_12_TARGETED_PRACTICE.md`
- `docs/LAYER_13_AUTH_CLOUD_PROGRESS.md`
- `docs/LAYER_13_SUPABASE_SETUP.md`
- `docs/LAYER_14_ARCHITECTURE_DECISION.md`
- `docs/LAYER_14_ENVIRONMENT_PLAN.md`
- `docs/LAYER_14_CONTENT_BOUNDARY.md`
- `data/content-access.json`
- `data/progress-schema.json`
- `data/question-bank-manifest.json`
- `editorial.html`
- `privacy.html`

## Repository workflow

Major product layers are developed on dedicated branches and opened as draft pull requests. A layer must not be merged until its automated workflows pass, its security boundaries are reviewed, desktop and mobile behavior is verified, staging evidence is complete, and explicit merge approval is given.

Layer 14 must remain in draft until Site Quality, Browser Quality, Database Quality, new protected-delivery security checks, public-build leakage scans, staging verification, and owner approval are complete.
