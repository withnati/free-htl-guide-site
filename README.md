# Free HTL Guide

Free HTL Guide is an account-ready HT/HTL learning platform in active development. The current public GitHub Pages build contains seven learning modules, module quizzes, a six-week study plan, cumulative practice, a 50-question mock exam backed by a 150-record development bank, and a private local-progress dashboard.

## Product direction

The project is transitioning from a static study guide into a subscription learning platform.

- **Public launch content:** homepage, instructor and editorial information, course outline, the complete Fixation lesson, a sample quiz, feature previews, pricing, and signup.
- **Premium-designated content:** lessons 2–7, full module quizzes, the 150-record question bank, mock exams, targeted practice, complete progress history, and weak-domain recommendations.
- **Account features:** authenticated identity, cloud-backed learning progress, resumable sessions, progress export, and account deletion.

The current deployment is a development preview. Access metadata does not provide security, and browser storage cannot grant a paid entitlement. Premium content must be moved behind authenticated, server-authorized delivery before a paid launch.

## Current architecture

- Static frontend deployed through GitHub Pages during development
- Privacy-first, consent-gated analytics
- Versioned learner-progress record
- Replaceable progress-storage adapter
- Stable question and selected-option IDs
- Premium/public access metadata
- Automated Python contract validation
- Desktop and mobile Playwright browser testing

## Current development status

- Layers 1–11 are merged into `main`.
- Layer 12 Targeted Practice is under review in draft PR #17.
- Layer 13 will introduce authentication and cloud progress after Layer 12 is approved and merged.
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
```

On the Layer 12 branch, also run:

```bash
python scripts/validate_targeted_practice.py --root .
```

Run browser tests:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

## Key project documents

- `docs/LAYER_11_ACCOUNT_READY_PROGRESS.md`
- `docs/LAYER_12_TARGETED_PRACTICE.md` on the Layer 12 branch
- `data/content-access.json`
- `data/progress-schema.json`
- `data/question-bank-manifest.json`
- `editorial.html`
- `privacy.html`

## Repository workflow

Major product layers are developed on dedicated branches and opened as draft pull requests. A layer should not be merged until the protected Site Quality and Browser Quality workflows pass and explicit approval is given.
