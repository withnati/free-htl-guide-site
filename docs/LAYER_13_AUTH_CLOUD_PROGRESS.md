# Layer 13 — Authentication and cloud progress

**Status:** In progress — authentication, remote schema, cloud dashboard adapter, and explicit browser import are implemented on the draft branch  
**Branch:** `layer-13-auth-cloud-progress`  
**Depends on:** Layer 12 merge commit `a130066847650988181e1d0c452f920bb7cf252b`

## Goal

Layer 13 adds verified learner accounts and cloud-backed progress without rebuilding the existing lessons, quizzes, mock exam, Targeted Practice, or dashboard.

The central implementation rule is:

> Keep the existing asynchronous `progressService` contract and add an authenticated cloud adapter beside the current local browser adapter.

Anonymous visitors continue to use browser storage. Signed-in learners use cloud storage and may explicitly import compatible anonymous progress from the current browser.

## Technology decision

Use Supabase for the first production backend:

- Supabase Auth for email/password accounts, email verification, password recovery, and sessions;
- Supabase PostgreSQL for learner progress;
- PostgreSQL Row Level Security for per-user authorization;
- Supabase Edge Functions only for privileged operations such as deleting an Auth user;
- Supabase CLI migrations as the database source of truth.

The approved development project is `oqbubeklssmlkjjtqczr`. The repository contains only the project URL and browser-safe publishable key. Secret keys, service-role credentials, database passwords, and developer access tokens remain outside the repository.

The initial migration has also been applied successfully to the remote development project. Supabase reported `Success. No rows returned`, which is the expected result for a schema migration.

## Architecture

```text
Browser
  ├── Auth service
  │     ├── sign up
  │     ├── verify email
  │     ├── sign in
  │     ├── password recovery
  │     └── sign out
  │
  └── progressService
        ├── LocalProgressAdapter      anonymous browser progress
        └── CloudProgressAdapter      authenticated progress
                                      │
                                      ▼
                               Supabase PostgreSQL
                                      │
                                      └── Row Level Security
```

Pages continue to call the progress service. Lesson, quiz, mock-exam, Targeted Practice, and dashboard code do not write directly to Supabase tables.

## Data-model decisions

The cloud model uses separate records instead of saving the entire learner profile as one JSON document. This prevents a stale device from replacing unrelated newer progress.

### `profiles`

One account-facing profile per Auth user. Email remains owned by Supabase Auth and is not duplicated into learner-progress tables.

### `module_progress`

One row per user and module. Stores module start, latest activity, latest section, viewed-section IDs, completion, and a revision number.

### `study_task_progress`

One row per user, study-plan page, and task ID.

### `learning_attempts`

One parent row for every completed module quiz, mock exam, or Targeted Practice attempt. Stable client-generated attempt IDs make retries idempotent.

### `attempt_domain_results`

Stores correct and total counts for each exam domain. Weak-domain calculations must aggregate counts rather than average differently sized attempts equally.

### `attempt_question_results`

Stores stable question IDs, source-question IDs, selected-option IDs, correctness, domain, difficulty, and flag state. It never stores question text, explanations, or answer keys.

### `active_sessions`

Stores unfinished mock-exam and Targeted Practice session metadata, ordered question IDs, current position, mode, filters, timestamps, and a revision number.

### `active_session_responses`

Stores selected-option IDs, flag state, and Study-mode feedback state per active-session question. This avoids an unrestricted session JSON document.

### `learning_activity`

Stores a limited, structured activity feed using safe IDs, codes, counts, scores, and modes rather than arbitrary browser-provided prose.

### `progress_migrations`

Records anonymous-browser imports so the same anonymous record cannot be imported repeatedly.

## Security boundaries

Every user-owned table:

1. references `auth.users(id)` with cascade deletion;
2. enables Row Level Security;
3. allows authenticated users to access only rows where `auth.uid() = user_id`;
4. denies anonymous database access;
5. avoids storing question text, explanations, answer keys, personal notes, email addresses, analytics consent, or theme preference.

The browser receives only the project URL and browser-safe publishable key. Secret keys, service-role credentials, and administrative database credentials do not appear in repository frontend files.

Paid status remains outside Layer 13. Account identity controls progress ownership; a later server-verified entitlement system will control premium access.

## Cloud adapter behavior

`assets/cloud-progress-adapter.js` now implements the existing `load`, `save`, and `clear` adapter contract.

It:

- reads and writes all ten learner-progress tables;
- reconstructs the normalized local progress shape for the existing dashboard;
- inserts completed attempts idempotently by stable attempt ID;
- keeps question content out of learner records;
- merges module section sets and completion timestamps;
- chooses the newest mutable study-task and active-session state;
- maps active-session responses into separate rows;
- records anonymous imports in `progress_migrations`;
- keeps the original local-storage record as a temporary recovery backup until the learner resets it.

The first connection point is My Progress. This controlled rollout proves the import and cloud-dashboard behavior before the adapter is automatically activated on every lesson and practice page.

## Anonymous-to-account migration

After verified sign-in, My Progress detects a compatible normalized local record and presents an explicit choice:

- **Import and enable cloud sync**; or
- **Use account progress only**.

The implemented migration process:

1. checks the stable anonymous record ID against completed migrations;
2. counts the records that will be imported;
3. creates or resumes a migration record;
4. fetches existing cloud progress;
5. merges module sections and completion safely;
6. imports unique attempts by stable IDs;
7. chooses the newest mutable task or active-session record;
8. writes the merged result through the cloud adapter;
9. marks the migration complete only after successful writes;
10. remains safe to retry without duplicating completed attempts.

Choosing account-only leaves the browser record untouched. A cloud reset removes both the cloud progress and the temporary browser backup while preserving account identity and privacy settings.

## Authentication experience

The branch includes:

- account creation with display name, email, password, and policy consent;
- verified-email handoff and resend flow;
- email/password sign in;
- neutral forgotten-password response;
- password reset;
- secure callback handling;
- account settings and sign out;
- PKCE session flow, persisted sessions, automatic refresh, and URL session detection;
- same-origin and project-prefix validation for post-authentication redirects;
- private `noindex,nofollow` account pages excluded from the sitemap;
- a visible account entry point from My Progress.

Google sign-in remains optional and should follow only after the email/password flow and cloud adapter are stable.

## Automated validation

At the verified cloud-adapter checkpoint:

- Site Quality passes, including the cloud-adapter/import validator and negative regression tests;
- Browser Quality passes with the real adapter against an in-memory Supabase implementation;
- Database Quality passes against a fresh local Supabase/PostgreSQL stack;
- all 14 two-user Row Level Security assertions pass;
- browser coverage verifies signed-out local behavior, explicit import, account-only behavior, cloud dashboard rendering, stable-attempt deduplication, and module-section merging.

## Deployment boundary

GitHub Pages remains the development/public host while authentication and cloud progress are built. Layer 13 does not secure premium lesson or question-bank files. Protected content delivery and production hosting changes belong to Layer 14.

Authentication URL configuration and migration deployment instructions are documented in `docs/LAYER_13_SUPABASE_SETUP.md`.

## Implementation sequence

### 13.1 — Backend foundation

**Status:** Complete and passing Database Quality.

### 13.2 — Authentication UI

**Status:** Implemented on the draft branch. Supabase URL configuration and remote migration are complete; live signup, verification-email, recovery-email, and reset-link testing still require a deployable preview or merge.

### 13.3 — Cloud adapter

**Status:** Implemented and passing static/browser tests on My Progress. Site-wide automatic adapter activation remains.

### 13.4 — Anonymous import

**Status:** Explicit import and account-only paths are implemented and tested. Live remote import verification remains.

### 13.5 — Privacy and resilience

Progress export and cloud-aware progress reset are implemented. Remaining work:

- secure Auth account deletion;
- offline pending-operation queue;
- saving/saved/offline/error status across learning pages;
- revision-conflict detection and learner choice;
- site-wide cloud adapter activation.

### 13.6 — Validation

Remaining work:

- live signup and email-delivery test;
- live remote import and second-device test;
- multi-device revision-conflict test;
- desktop, mobile, keyboard, and accessibility review of the live account flow.

## Definition of done

Layer 13 is complete when a learner can:

1. create and verify an account;
2. sign in and out securely;
3. import compatible browser progress by choice;
4. continue progress on another device;
5. resume unfinished cloud sessions;
6. view cloud-backed dashboard history;
7. export their learning progress;
8. delete their account and progress;
9. access only their own database records;
10. use the anonymous local experience without an account.

Layer 13 does not charge users, secure premium files, or grant paid access.