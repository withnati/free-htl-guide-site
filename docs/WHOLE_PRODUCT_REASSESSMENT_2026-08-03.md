# FHL Whole-Product Reassessment — 2026-08-03

## Purpose and evidence base

This reassessment ranks the next work for FHL as one learning product rather than assuming that the newest technical layer is automatically the priority. It is based on the repository at V5.0 checkpoint `74b11c453b73ccbb4806518fc1da26a6507ef166`, the six project-source PDFs (31 pages total), the repository source and operational documents, the generated public build, automated test results, GitHub state, and desktop/mobile visual review.

The assessment did not change or copy protected source material. Files under the project-level `sources/` directory remained read-only and are not part of this repository.

## Scoring method

Scores use a 1–5 scale. For the first six columns, 5 means greater value, urgency, safety, or testability. For the final two columns, 5 means greater dependence on the owner or scientific review and therefore less overnight autonomy.

| # | Product area | Learner impact | Security / trust risk | Revenue relevance | Current brokenness | Safe tonight | Testability | Owner dependence | Scientific dependence |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Homepage and positioning | 5 | 2 | 5 | 2 | 4 | 5 | 3 | 1 |
| 2 | Course structure and navigation | 5 | 1 | 4 | 2 | 4 | 5 | 2 | 2 |
| 3 | Free Fixation learning experience | 5 | 2 | 4 | 1 | 3 | 5 | 2 | 4 |
| 4 | Account creation and sign-in | 5 | 5 | 4 | 2 | 4 | 5 | 2 | 1 |
| 5 | Progress persistence and cross-device continuity | 5 | 4 | 4 | 2 | 4 | 5 | 2 | 1 |
| 6 | Pricing and plan clarity | 4 | 3 | 5 | 2 | 3 | 5 | 4 | 1 |
| 7 | Checkout, billing, cancellation, and recovery | 4 | 5 | 5 | 2 | 2 | 4 | 5 | 1 |
| 8 | Premium authorization and protected delivery | 5 | 5 | 5 | 1 | 3 | 5 | 4 | 3 |
| 9 | Cumulative practice | 5 | 2 | 4 | 2 | 4 | 5 | 2 | 4 |
| 10 | Mock exams | 5 | 2 | 4 | 2 | 4 | 5 | 2 | 4 |
| 11 | Targeted Practice | 5 | 3 | 4 | 4 | 5 | 5 | 1 | 4 |
| 12 | Question-bank quality and runtime | 5 | 4 | 4 | 2 | 3 | 5 | 2 | 5 |
| 13 | Learner dashboard and recommendations | 5 | 2 | 4 | 3 | 5 | 5 | 2 | 2 |
| 14 | Mobile experience | 5 | 2 | 4 | 2 | 5 | 5 | 1 | 1 |
| 15 | Accessibility and reduced motion | 5 | 3 | 4 | 4 | 5 | 5 | 1 | 1 |
| 16 | Error, empty, offline, and recovery states | 5 | 4 | 3 | 2 | 4 | 5 | 2 | 1 |
| 17 | Privacy, terms, editorial trust, and claims | 5 | 5 | 4 | 3 | 3 | 4 | 4 | 3 |
| 18 | Analytics safeguards | 3 | 5 | 3 | 1 | 4 | 5 | 2 | 1 |
| 19 | SEO and public-content discoverability | 4 | 2 | 4 | 3 | 3 | 5 | 4 | 2 |
| 20 | Performance and asset efficiency | 4 | 2 | 4 | 2 | 4 | 4 | 1 | 1 |
| 21 | Deployment safety and launch readiness | 5 | 5 | 5 | 4 | 3 | 5 | 5 | 1 |
| 22 | Documentation and operational handoff | 4 | 4 | 4 | 5 | 5 | 5 | 2 | 1 |

## Present condition

### Strong foundations

- The generated public build is allowlisted and excludes the protected question bank, answer material, proof payloads, migrations, tests, and server-only code.
- Identity, entitlement, protected delivery, progress synchronization, conflict handling, billing lifecycle, and analytics each have meaningful automated coverage.
- The free Fixation lesson provides a useful acquisition surface instead of an empty marketing shell.
- Learner-owned cloud data is designed around Row Level Security, server-derived identity, and explicit import choices.
- Consent-gated analytics avoids answer content and supports consent withdrawal.
- Desktop and mobile browser suites cover the central learner and account journeys.

### Highest-value gaps

1. **Operational truth and launch controls.** The README and roadmap describe a substantially older milestone state. GitHub `main` also has no branch-protection rule, so the documented all-green workflow is convention rather than an enforced control.
2. **Scientific completion.** Eighty alternate question scenarios remain in final scientific/editorial review. They should not be promoted as fully reviewed or used for high-stakes claims.
3. **Production decisions.** Production domain, production Supabase separation, live-provider approval, legal/tax/refund wording, pricing authority, and go-live timing require owner decisions. Sandbox validation is not production approval.
4. **Public positioning.** The product has credible learning and security foundations, but final homepage positioning, instructor proof, pricing claims, and lifecycle communications need owner-approved language and evidence.
5. **Accessibility consistency.** Visual review found dark-theme link contrast, global keyboard focus, and reduced-motion gaps. These were safe to correct independently.
6. **Practice persistence.** The full gate exposed an intermittent Targeted Practice resume path. Rapid saves and test initialization required deterministic ordering.

## Ranked execution plan

| Rank | Work | Why now | Status |
|---:|---|---|---|
| 1 | Stabilize Targeted Practice resume persistence | Direct learner retention risk; reproducible and highly testable | Completed in PR #46 |
| 2 | Establish global accessibility foundations | Site-wide learner impact; low owner/science dependence | Completed in PR #47 |
| 3 | Publish this evidence-based reassessment | Prevents layer-driven prioritization and records blockers | In progress |
| 4 | Correct README and roadmap milestone truth | Reduces launch and contributor error | Next safe work |
| 5 | Add enforceable `main` protection / required checks | High operational risk; repository-owner setting | Owner action required |
| 6 | Audit dashboard recommendations and empty/recovery states | High learner impact and retention relevance | Safe follow-up |
| 7 | Verify staging account, entitlement, billing, and recovery journeys | High trust/revenue relevance | Staging credentials and sandbox only |
| 8 | Complete the 80-scenario scientific/editorial review | Required for trustworthy assessment expansion | Scientific reviewer required |
| 9 | Finalize positioning, pricing, legal, tax, refund, and launch claims | High conversion relevance | Owner/legal decisions required |
| 10 | Production cutover and live payment validation | Material external effect | Explicit production approval required |

## Decisions and blockers

| Blocker | Decision or evidence needed | Safe continuation |
|---|---|---|
| No GitHub branch protection on `main` | Owner selects required checks, review policy, and bypass rules | Continue using exact-SHA checks and green-only merges manually |
| Scientific review incomplete for 80 variants | Qualified reviewer approval and correction record | Keep transparent review-status copy and avoid stronger claims |
| Production domain and hosting cutover undecided | Owner selects canonical domain and authorizes cutover | Use development, previews, and staging only |
| Production Supabase separation not confirmed | Owner provisions/approves production project and secrets | Use existing staging project only |
| Live billing not authorized | Owner approves live products, prices, tax/refund/legal posture, and test plan | Use provider sandbox/test mode only |
| Final public authority and conversion claims | Owner supplies verifiable instructor/business evidence and approved claims | Improve structure and accessibility without inventing proof |

## Verification baseline

- Repository tests: 179 passed.
- Public build: 81 allowlisted files and 10 Premium preview routes; protected question-bank and proof payload absent.
- Browser gate after reliability work: 147 passed and 33 intentionally skipped.
- Browser gate after accessibility work: 148 passed and 34 intentionally skipped.
- Cloudflare preview, Site Quality, Browser Quality, and Layer 14 Security checks passed on the exact PR heads before merge.

## Guardrails for the next work

- Keep project `sources/` read-only.
- Use focused `agent/*` branches and draft PRs.
- Verify the PR head SHA immediately before merge.
- Merge only when every applicable check is green.
- Keep staging/development and provider sandbox distinct from production approval.
- Do not strengthen medical, exam, authority, endorsement, pricing, refund, privacy, or performance claims without evidence and the appropriate reviewer.
- Treat authentication as identity, not entitlement; keep Premium authorization server-side before delivery.
