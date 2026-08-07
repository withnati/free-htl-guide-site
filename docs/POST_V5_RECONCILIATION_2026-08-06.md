# FHL Post-V5 Repository Reconciliation — 2026-08-06

## Purpose

This record reconciles the V5.0 source checkpoint with the actual repository state after the subsequent product-improvement work. It is intended to provide a clean continuation baseline for future development without treating the V5.0 document as if it described the current implementation.

## Controlling implementation baseline

- Repository: `withnati/free-htl-guide-site`
- Default branch: `main`
- Reconciled main commit before this documentation branch: `e9a101bedb07aa65c6ff428a1f92dcf4f1fe1755`
- V5.0 starting commit: `74b11c453b73ccbb4806518fc1da26a6507ef166`
- Relationship: current main is 32 commits ahead of the V5.0 starting commit and zero commits behind.
- Latest merged product change: PR #64, **Release protected Embedding and Microtomy lesson**.

GitHub `main` is the implementation truth. The V5.0 source document remains the historical billing/deployment checkpoint and should not be read as a complete description of the current learner experience.

## Work completed after V5.0

### Reliability and accessibility

- PR #46 — Stabilized Targeted Practice resume persistence by serializing rapid session writes and strengthening reload/resume coverage.
- PR #47 — Added global keyboard focus treatment, dark-theme link contrast fixes, and reduced-motion support.
- PR #52 — Reworked mobile analytics-consent presentation into a compact, safe-area-aware bottom sheet with equal Allow/Decline prominence.
- PR #55 — Added bounded recovery for transient Supabase account clock-skew errors while preserving fail-safe behavior for unrelated authentication failures.

### Whole-product prioritization and project truth

- PR #48 — Added the 22-area whole-product reassessment so work is ranked by learner value, trust, revenue relevance, brokenness, autonomy, and testability rather than by layer number alone.
- PR #49 — Updated repository documentation to match the V5.0 staging/sandbox checkpoint and production gates.

### Premium learner experience and entitlement-aware UI

- PR #50 — Added a shared entitlement-aware Premium UI controller backed by trusted subscription status and removed stale signed-out/coming-soon states for active Premium learners.
- PR #51 — Added the Premium learning library and routed confirmed Premium learners toward protected learning destinations while retaining server-side authorization before delivery.
- PR #53 — Hardened protected lesson loading, authorization-loss, offline, retry, return-destination, and accessibility states.
- PR #54 — Added trusted offline states across Premium library and preview experiences without treating connection failure as entitlement loss.
- PR #58 — Improved Premium dashboard next-step recommendations so learners are directed only to actually released protected experiences.
- PR #59 — Extended encrypted-credential staging smoke coverage to the real Premium dashboard and protected routes.

### Protected Premium releases

- PR #56 — Released the account-verified six-week HT/HTL study plan through private Premium delivery, with 35 progress-linked study tasks.
- PR #64 — Released the reviewed Embedding and Microtomy lesson through the protected-content service while excluding quiz questions, answers, and rationales from the payload and public build.

At this checkpoint the Premium learning library presents these experiences as **available now**:

1. Processing and Decalcification lesson.
2. Embedding and Microtomy lesson.
3. Six-week HT/HTL study plan.

The remaining course lessons, practice/mock exams, and Targeted Practice are still labeled as secure releases in progress.

### Staging verification and learner-facing truth

- PR #57 — Added a manual staging-only authenticated Premium smoke workflow using encrypted test-account secrets and credential-safe artifact settings.
- PR #60 — Corrected the FAQ so Premium availability matches the actual released experiences.
- PR #61 — Corrected pricing-page claims so unreleased tools are not represented as currently available.
- PR #62 — Aligned homepage and account Premium copy with the actual release state rather than the complete future platform scope.
- PR #63 — Updated dashboard lesson-status labels to distinguish learner progress from product release status.

## Current protected-delivery allowlist

The Premium Edge Function currently recognizes these server-controlled content IDs:

- `processing-proof-v1`
- `study-plan-v1`
- `embedding-microtomy-v1`

For every protected request, the server still validates the exact allowed origin, verifies the bearer session, derives the learner identity from Supabase Auth, resolves the content ID through a server allowlist, checks the effective `fhl-premium` entitlement, and only then downloads the private object. Browser-supplied user IDs, product codes, object paths, and entitlement decisions remain untrusted.

## Current validation baseline

The exact PR #64 head `e72500c5072bb8b66314ebaa5e20efb32e715ac9` completed the applicable GitHub workflows successfully:

- Site quality — success
- Browser quality — success
- Database quality — success
- Layer 14 security — success

PR #64 also recorded:

- 193 Python tests passing;
- 153 ordinary browser tests passing, with 41 intentional skips;
- 40 generated-public-site browser tests passing;
- 88 allowlisted generated public files;
- 10 Premium preview routes;
- no protected question bank or lesson payload in the public build.

## Current product boundary

### Public/free acquisition experience

- Public homepage, course outline, trust/editorial pages, pricing, signup, and previews.
- Complete public Fixation lesson and approved public sample-question runtime.
- Anonymous local progress for the free experience.
- Free registered account value including identity, basic cloud progress, and cross-device continuity where implemented.

### Premium experience available now

- Server-verified Premium identity projection in the learner shell.
- Protected Processing and Decalcification lesson.
- Protected Embedding and Microtomy lesson.
- Protected six-week study plan with account-linked progress.
- Premium learning library and entitlement-aware dashboard guidance.
- Subscription status and billing-management experience in the validated sandbox/staging architecture.

### Premium scope not yet released for secure study

- Routine H&E Staining lesson.
- Special Stains lesson.
- Laboratory Operations lesson.
- IHC/ISH Fundamentals lesson.
- Full Premium quizzes.
- Mixed-domain cumulative practice.
- Full mock-exam release.
- Targeted Practice release.
- Protected downloads and the broader future Premium toolset.

## Important unresolved gates

1. **Scientific/editorial review:** the 80 alternate development-bank scenarios still require final manual scientific and editorial approval before they are marketed as fully reviewed Premium assessment content.
2. **Production environment:** production Supabase, production Cloudflare configuration, canonical production domain, and production secrets remain separate owner-controlled work.
3. **Live billing:** Stripe business verification, public business information, tax/refund/legal decisions, live products/prices, production webhook configuration, lifecycle evidence, and controlled real-payment smoke testing remain blocked until explicit owner approval.
4. **Repository governance:** enforceable `main` branch protection and required checks are still an owner-controlled repository setting.
5. **Repository visibility/content privacy:** the repository remains public; revised or newly created launch-Premium assets must remain outside public Git history.
6. **Current documentation:** V5.0 remains an important historical checkpoint, but future source-document updates should start from this post-V5 repository state rather than repeating the older launch boundary.

## Recommended next work

Continue progressive Premium release and launch-readiness work in small, verifiable increments. The highest-value autonomous work should prioritize:

1. learner-facing consistency and recovery defects;
2. protected release of scientifically ready lesson content without exposing assessments prematurely;
3. Premium dashboard and journey quality as each secure experience becomes available;
4. mobile/accessibility regression protection;
5. documentation truth and launch-control clarity.

Do not promote unreleased assessment tools merely because their development code exists. Secure delivery, scientific/editorial approval, staging evidence, and truthful learner-facing claims remain separate release gates.

## Guardrails to preserve

- Authentication proves identity; entitlement grants Premium access.
- Premium authorization is server-side before delivery.
- Revocation must affect the next protected request.
- Service-role, payment, webhook, database, and deployment secrets remain server-only.
- Public builds deploy the generated allowlisted `dist/` directory, not the repository root.
- The free Fixation experience remains a meaningful acquisition hook.
- Progress storage excludes full question text, answer keys, explanations, and unrestricted protected-content blobs.
- Production and live billing require explicit owner approval.
- Scientific claims and assessment releases require appropriate review evidence.
