# FHL Website Product Roadmap

**Project:** Free HTL Guide / FHL educational platform  
**Current completed checkpoint:** V5.0 — staging deployment, protected delivery, subscription lifecycle, Fixation runtime pilot, and sandbox billing validation
**Current active milestone:** launch-readiness closure without production cutover

## Product goal

Build a world-class histotechnology learning and certification-preparation platform that combines excellent educational quality, a strong free acquisition experience, trusted learner accounts, protected premium content, measurable learning progress, and a sustainable subscription business.

Website structure, educational content, learner experience, security, monetization, and maintainability are treated as one product system.

## Stable product principles

1. Keep useful, search-visible public learning content.
2. Make the free-to-premium journey clear without making the free experience empty.
3. Authentication proves identity only; server-controlled entitlement grants premium access.
4. Premium content must be protected before delivery.
5. Learner progress remains behind the central progress-service contract.
6. Anonymous learners may continue using local browser progress for the free experience.
7. Verified learners may use cloud progress and cross-device continuity.
8. Supabase Row Level Security remains mandatory for learner-owned data.
9. Secret and service credentials remain server-only.
10. Completed attempts remain stable and idempotent; mutable sessions use revisions and explicit conflict handling.
11. Cloud progress contains stable identifiers and results, not full question text, explanations, answer keys, or personal notes.
12. Major work is developed in protected draft pull requests and is not merged without explicit approval.

## Completed milestones

### Layers 1–10 — educational foundation and question-bank growth

Delivered the initial structured learning site, educational modules, module quizzes, authority/editorial controls, SEO and sharing metadata, privacy-conscious analytics, cumulative practice, a 50-question mock exam, and a 150-record development question bank.

Important remaining editorial boundary: 70 base questions are authority-reviewed; 80 alternate scenarios still require final scientific and editorial review.

### Layer 11 — account-ready progress foundation

Delivered:

- central progress-service contract;
- versioned progress schema;
- stable question and option identifiers;
- anonymous local progress;
- My Progress dashboard;
- import/export/reset allowlists;
- access-tier metadata that explicitly does not provide authorization.

### Layer 12 — account-ready Targeted Practice

Delivered:

- 10-, 20-, and 30-question targeted sets;
- Study and Exam modes;
- domain and difficulty filters;
- weighted weak-domain practice;
- exact previously missed and flagged-question modes;
- resumable sessions;
- integration with the central progress service;
- corrected editorial wording and browser behavior.

Merged through PR #17 as commit `a130066847650988181e1d0c452f920bb7cf252b`.

### Layer 13 — verified accounts and cloud progress

Delivered:

- Supabase authentication;
- signup and email verification;
- sign-in, sign-out, recovery, and reset;
- account settings;
- controlled authentication callbacks;
- normalized cloud progress across ten relational tables;
- anonymous-to-account import and account-only mode;
- cross-device synchronization;
- offline pending-write recovery;
- visible saving, saved, offline, sync-problem, and conflict states;
- revision-based active-session conflict protection;
- explicit conflict choices;
- secure account deletion through an Edge Function;
- RLS ownership enforcement and two-user database assertions;
- Site, Browser, and Database Quality workflows.

Merged through PR #18 as commit `405686a2193282d246d2c2878b9bafb015617aea`.

## Implemented milestones after Layer 13

### Layers 14–16.9 — protected delivery, subscriptions, question runtime, and sandbox billing

The V5.0 checkpoint implements and validates the following in staging/development and provider sandbox environments:

This checkpoint preserves the milestone sequence: Layer 14 established protected delivery, Layer 15 established subscription architecture and learner UX, and Layer 16 established the question runtime and sandbox-billing integration.

Approved architecture:

- Cloudflare Pages for public frontend hosting, previews, production deployments, TLS, custom domains, headers, and rollback;
- Supabase Auth for verified identity;
- Supabase PostgreSQL for learner progress and server-controlled entitlements;
- Supabase Edge Functions for session and entitlement checks;
- private Supabase Storage for protected content;
- server-created subscription checkout and billing-portal flows in sandbox;
- idempotent lifecycle webhook processing and reconciliation;
- subscription UX and duplicate-subscription prevention;
- canonical question records, review workflow, and protected runtime delivery;
- an approved Fixation runtime pilot with shadow verification and public fallback safety.

The following production gates remain deliberately incomplete:

- canonical production domain and controlled Cloudflare production cutover;
- separate approved production Supabase configuration and secrets;
- live payment products, prices, tax posture, refund policy, legal wording, and owner authorization;
- final scientific/editorial review of the 80 alternate question scenarios;
- production smoke, rollback, monitoring, and incident evidence;
- explicit owner approval before any live billing or production deployment.

## Launch-readiness workstreams

### Subscription production readiness

Primary objective: promote the validated sandbox lifecycle to production only after every owner-controlled gate is satisfied.

Remaining production scope:

- final plan and pricing decision;
- cancellation and renewal communication;
- tax, refund, privacy, and terms review;
- approved live-provider products, prices, credentials, and webhook destination;
- reconciliation and recovery rehearsal against production-like configuration;
- production payment testing and rollback procedures.

Security boundary:

- browser payment success redirects do not grant access;
- only verified server-side payment events may update entitlement;
- duplicate and out-of-order webhook events must be handled safely;
- payment secrets remain server-only.

### Launch funnel, conversion, and product optimization

Primary objective: turn the secure educational platform into a trusted, measurable, sustainable learning business.

Planned scope:

- final homepage and course positioning;
- public course outline and premium comparison;
- pricing presentation;
- instructor authority and trust signals;
- onboarding journey;
- conversion paths from public lessons and sample questions;
- lifecycle email strategy subject to consent and privacy review;
- learner retention and re-engagement;
- accessibility and performance refinement;
- search strategy for public educational content;
- analytics that measure acquisition and conversion without collecting answer content;
- support and incident communication;
- launch checklist and controlled release;
- post-launch feedback and experiment process.

## Future expansion candidates

These are not committed milestones and require separate prioritization:

- additional full-length mock exams;
- larger reviewed question banks;
- personalized study recommendations;
- spaced repetition;
- certificates of completion;
- continuing-education pathways where legally and professionally appropriate;
- institutional licensing;
- instructor dashboards;
- cohort and classroom tools;
- employer or school partnerships;
- mobile application packaging;
- additional laboratory-science subjects.

## Cross-cutting workstreams

### Educational quality

- Complete scientific and editorial review of the 80 alternate scenarios.
- Maintain source authority, review dates, and correction history.
- Distinguish independently created preparation material from official certification content.
- Avoid claims of guaranteed passing or official endorsement.

### Security and privacy

- Maintain strict public/protected boundaries.
- Preserve RLS and server-only secrets.
- Minimize stored personal data.
- Keep progress exports, resets, and deletion deliberate and allowlisted.
- Review dependencies and deployment access regularly.

### Engineering quality

- Deterministic dependency installation with a committed lockfile and `npm ci`.
- Site, Browser, Database, and Layer-specific Security workflows.
- Preview deployments and rollback evidence.
- Incremental commits and updated draft PR descriptions.
- Exact-head verification before merge.

### Governance

- Maintain milestone issues and editorial-review tracking.
- Add CODEOWNERS before external collaboration grows.
- Review obsolete branches only after rollback needs are resolved.
- Update the controlled project source document after each approved milestone merge.

## Current open items

- Final scientific and editorial review of 80 alternate scenarios.
- Select production domain and staging hostname.
- Establish and approve the production Supabase project and secrets.
- Authorize the controlled Cloudflare production cutover.
- Decide repository privacy timing before new launch-premium content is added.
- Configure enforceable GitHub branch protection and required checks for `main`.
- Confirm public post-merge account routes before directing real learners to signup.
- Consider CODEOWNERS before adding external collaborators.
- Complete live-billing, pricing, tax, refund, legal, monitoring, and rollback gates in `LIVE_BILLING_LAUNCH_READINESS.md`.
