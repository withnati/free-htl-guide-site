# Layer 13 — Authentication and cloud progress

**Status:** In progress  
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

No remote Supabase project, production credentials, or paid entitlement system is created by this initial commit.

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

Pages must continue to call the progress service. Lesson, quiz, mock-exam, Targeted Practice, and dashboard code must not write directly to Supabase tables.

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

Every user-owned table must:

1. reference `auth.users(id)` with cascade deletion;
2. enable Row Level Security;
3. allow authenticated users to access only rows where `auth.uid() = user_id`;
4. deny anonymous database access;
5. avoid storing question text, explanations, answer keys, personal notes, email addresses, analytics consent, or theme preference.

The browser may receive only the project URL and browser-safe publishable key. Secret keys, service-role credentials, and administrative database credentials must never appear in repository frontend files.

Paid status remains outside Layer 13. Account identity controls progress ownership; a later server-verified entitlement system will control premium access.

## Sync rules

### Completed attempts

Completed attempts are append-only in normal use and upserted by stable `(user_id, attempt_id)` identity. Retrying the same network request must not create duplicates.

### Module and study-task progress

Mutable rows carry revision and server-update timestamps. Cloud writes must not silently replace a newer revision.

### Active sessions

An active session is unique per user and session type. Conflicting newer revisions must be surfaced to the learner rather than overwritten.

### Server time

Server timestamps are authoritative for ordering cloud records. Client timestamps may be retained only as source context.

## Anonymous-to-account migration

After verified sign-in, the application may detect the normalized local record and offer an explicit import.

The migration process must:

1. validate the local record against the supported schema version;
2. project it through an explicit cloud allowlist;
3. fetch existing cloud progress;
4. merge module sections and completion safely;
5. import unique completed attempts by stable IDs;
6. resolve active-session conflicts explicitly;
7. write a `progress_migrations` record;
8. verify the imported cloud data before marking the browser record migrated;
9. remain idempotent if retried.

Migration must never silently replace existing account progress.

## Authentication experience

Layer 13 will add:

- account creation;
- verified email flow;
- sign in and sign out;
- forgotten-password request;
- password reset;
- expired-session handling;
- account settings;
- progress export;
- account and progress deletion through a privileged server function.

Google sign-in is optional and should follow only after the email/password flow is stable.

## Deployment boundary

GitHub Pages may remain the development preview while authentication and cloud progress are built. Layer 13 does not secure premium lesson or question-bank files. Protected content delivery and production hosting changes belong to Layer 14.

## Implementation sequence

### 13.1 — Backend foundation

- add the Supabase migration source tree;
- create relational progress tables, indexes, constraints, and RLS policies;
- add database tests for ownership isolation;
- document local development and secret handling.

### 13.2 — Authentication UI

- add signup, verification, sign-in, recovery, callback, and settings pages;
- add auth-aware navigation and session state;
- preserve anonymous use when signed out.

### 13.3 — Cloud adapter

- implement `CloudProgressAdapter` behind the existing progress service;
- add idempotent attempt writes;
- add revision-aware mutable writes;
- read the dashboard from cloud records.

### 13.4 — Anonymous import

- detect compatible browser progress;
- show an explicit import choice;
- sanitize, merge, upload, verify, and record migration status.

### 13.5 — Privacy and resilience

- add progress export;
- add delete-progress and delete-account flows;
- add saving, saved, offline, conflict, and error states;
- add retry-safe pending operations.

### 13.6 — Validation

- authentication browser tests;
- two-user Row Level Security tests;
- duplicate-attempt retry tests;
- multi-device revision-conflict tests;
- local-import idempotency tests;
- desktop, mobile, keyboard, and accessibility review.

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