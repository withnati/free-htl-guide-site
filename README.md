# Free HTL Guide

Free HTL Guide is an account-ready HT/HTL learning platform in active development. The current public GitHub Pages build contains seven learning modules, module quizzes, a six-week study plan, cumulative practice, a 50-question mock exam backed by a 150-record development bank, Targeted Practice, and a private local-progress dashboard.

## Product direction

The project is transitioning from a static study guide into a subscription learning platform.

- **Public launch content:** homepage, instructor and editorial information, course outline, the complete Fixation lesson, a sample quiz, feature previews, pricing, and signup.
- **Premium-designated content:** lessons 2–7, full module quizzes, the 150-record question bank, mock exams, targeted practice, complete progress history, and weak-domain recommendations.
- **Account features:** verified identity, cloud-backed learning progress, resumable sessions, progress export, and account deletion.

The current deployment is a development preview. Access metadata does not provide security, and browser storage cannot grant a paid entitlement. Premium content must be moved behind authenticated, server-authorized delivery before a paid launch.

## Current architecture

- Static frontend deployed through GitHub Pages during development
- Privacy-first, consent-gated analytics
- Versioned learner-progress record
- Replaceable progress-storage adapter
- Stable question and selected-option IDs
- Premium/public access metadata
- Supabase Auth and PostgreSQL foundation under Layer 13 development
- PostgreSQL Row Level Security contract and two-user ownership tests
- Automated Python contract validation
- Desktop and mobile Playwright browser testing

## Current development status

- Layers 1–12 are merged into `main`.
- Layer 13 authentication and cloud progress is under development in draft PR #18.
- The Layer 13 branch includes the relational database/RLS foundation, a browser-safe Supabase development configuration, and private signup, verification, sign-in, recovery, callback, and settings pages.
- The cloud progress adapter, anonymous-progress import, privacy operations, and end-to-end live account verification remain in progress.
- Layers 14–16 will cover protected premium content, payments/paywall, and the launch funnel.

The 150-record development bank contains 70 authority-reviewed base questions and 80 alternate scenarios that still require final manual scientific and editorial review.

## Local validation

Run the static and contract checks:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_site.py --root .
python scripts/validate_authority.py --root .
python scripts/validate_mock_exam.py --root .
python scripts/validate_seo.py --root .
python scripts/validate_analytics.py --root .
python scripts/validate_progress.py --root .
python scripts/validate_targeted_practice.py --root .
```

On the Layer 13 branch, also run:

```bash
python scripts/validate_cloud_progress.py --root .
python scripts/validate_auth.py --root .
supabase db start
supabase db lint --level warning --fail-on error
supabase test db
```

Run browser tests:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

## Key project documents

- `docs/LAYER_11_ACCOUNT_READY_PROGRESS.md`
- `docs/LAYER_12_TARGETED_PRACTICE.md`
- `docs/LAYER_13_AUTH_CLOUD_PROGRESS.md` on the Layer 13 branch
- `docs/LAYER_13_SUPABASE_SETUP.md` on the Layer 13 branch
- `data/content-access.json`
- `data/progress-schema.json`
- `data/question-bank-manifest.json`
- `editorial.html`
- `privacy.html`

## Repository workflow

Major product layers are developed on dedicated branches and opened as draft pull requests. A layer should not be merged until Site Quality, Browser Quality, and any layer-specific security/database workflows pass and explicit approval is given.
