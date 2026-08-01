# Layer 13 — Authentication and cloud progress

**Status:** In progress — authentication, remote schema, cloud dashboard adapter, and explicit browser import are implemented on the draft branch  
**Branch:** `layer-13-auth-cloud-progress`  
**Depends on:** Layer 12 merge commit `a130066847650988181e1d0c452f920bb7cf252b`

## Goal

Layer 13 adds verified learner accounts and cloud-backed progress without rebuilding the existing lessons, quizzes, mock exam, Targeted Practice, or dashboard.

The central rule is:

> Keep the existing asynchronous progress-service contract and add a `CloudProgressAdapter` beside the local browser adapter.

Anonymous visitors continue to use browser storage. Signed-in learners use cloud storage and may explicitly import compatible anonymous progress from the current browser.

## Technology decision

Use Supabase for the first production backend:

- Supabase Auth for email/password accounts, email verification, password recovery, and sessions;
- Supabase PostgreSQL for learner progress;
- PostgreSQL Row Level Security for per-user authorization;
- Supabase Edge Functions only for privileged operations such as deleting an Auth user;
- Supabase CLI migrations as the database source of truth.

The approved development project is `oqbubeklssmlkjjtqczr`. The repository contains only the project URL and browser-safe publishable key. Secret keys, service-role credentials, database passwords, and developer access tokens remain outside the repository.

The initial migration has been applied successfully to the remote development project. Supabase reported `Success. No rows returned`, which is expected for a schema migration.

## Architecture

```text
Browser
  ├── Auth service
  │     ├── sign up and verify email
  │     ├── sign in and sign out
  │     └── password recovery and reset
  │
  └── progress service
        ├── LocalProgressAdapter      anonymous browser progress
        └── CloudProgressAdapter      authenticated progress
                                      │
                                      ▼
                               Supabase PostgreSQL
                                      │
                                      └── Row Level Security
```

Pages continue to call the progress service. Lesson, quiz, mock-exam, Targeted Practice, and dashboard code do not write directly to Supabase tables.

## Data model

The cloud model uses separate records instead of saving the whole learner profile as one JSON document.

- `profiles`: account-facing display information; email remains in Supabase Auth.
- `module_progress`: module start, recent activity, viewed sections, completion, and revision.
- `study_task_progress`: one row per user, page, and task.
- `learning_attempts`: completed quiz, mock-exam, and Targeted Practice attempts.
- `attempt_domain_results`: correct and total counts by exam domain.
- `attempt_question_results`: stable question, source-question, and selected-option IDs plus correctness and flag state.
- `active_sessions`: unfinished session metadata, ordered question IDs, position, filters, timestamps, and revision.
- `active_session_responses`: selected-option IDs, flags, and Study-mode checked state per question.
- `learning_activity`: structured activity codes and safe metadata rather than arbitrary prose.
- `progress_migrations`: idempotency record for each imported anonymous browser record.

Question text, explanations, answer keys, personal notes, email addresses, analytics consent, and theme preference are excluded from learner-progress tables.

## Security boundaries

Every learner-owned table:

1. references `auth.users(id)` with cascade deletion;
2. enables Row Level Security;
3. allows authenticated users to access only rows where `auth.uid() = user_id`;
4. denies anonymous database access;
5. uses explicit, constrained columns rather than unrestricted learner-record JSON.

The browser receives only the project URL and browser-safe publishable key. Paid status remains separate from account identity and will require a later server-verified entitlement system.

## Sync decisions

### Completed attempts

Completed attempts use stable `(user_id, attempt_id)` identity. Normal retries use conflict-safe inserts and do not duplicate or overwrite completed attempts.

### Module and task progress

Module section sets are unioned. The earliest start/completion timestamps are preserved where appropriate, while the newest activity controls the current section. Study-task state is chosen by the newest valid update.

### Active sessions

One active session exists per user and session type. The current My Progress implementation chooses the newer local or cloud session during explicit import. A later Layer 13 increment must surface true multi-device revision conflicts before automatic site-wide writes are enabled.

### Server time

Server timestamps are authoritative for ordering cloud records. Client timestamps are retained only as source context.

## Anonymous-to-account migration

After verified sign-in, My Progress detects a compatible browser record and offers an explicit choice:

- **Import and enable cloud sync**; or
- **Use account progress only**.

The implemented process:

1. checks the stable anonymous record ID against completed migrations;
2. counts the records presented to the learner;
3. creates or resumes a migration row;
4. fetches existing cloud progress;
5. merges module sections and completion safely;
6. imports unique completed attempts by stable IDs;
7. chooses the newest mutable task or active-session state;
8. writes through `CloudProgressAdapter`;
9. marks the migration complete only after successful writes;
10. remains safe to retry without duplicating attempts.

Choosing account-only leaves browser progress untouched. A cloud reset removes cloud progress and the temporary browser backup while preserving account identity and privacy settings.

## Authentication experience

The branch includes:

- account creation with display name, email, password, and policy consent;
- verified-email handoff and resend flow;
- email/password sign in;
- neutral forgotten-password response;
- password reset;
- secure callback handling;
- account settings and sign out;
- PKCE, persisted sessions, automatic refresh, and URL session detection;
- same-origin and project-prefix validation for post-authentication redirects;
- private `noindex,nofollow` account pages excluded from the sitemap;
- account entry points and signed-in identity state on My Progress.

Google sign-in remains optional until the email/password and cloud flows are stable.

## Automated validation

The verified functional checkpoint includes:

- Site Quality with authentication, cloud-security, cloud-adapter, import, script-order, and secret-exclusion validators;
- Browser Quality using the real adapter against an in-memory Supabase implementation;
- Database Quality using a fresh local Supabase/PostgreSQL stack;
- 14 two-user Row Level Security assertions;
- browser coverage for signed-out local behavior, explicit import, account-only behavior, cloud dashboard rendering, stable-ID deduplication, and module-section merging.

## Current rollout boundary

The first cloud connection point is My Progress. This controlled rollout proves import and cloud-dashboard behavior before automatic cloud activation is added to every lesson and practice page.

GitHub Pages remains the current public host. Layer 13 does not secure premium lesson or question-bank files. Protected content delivery and production hosting changes belong to **Layer 14**.

## Implementation status

### 13.1 — Backend foundation

**Complete:** relational schema, constraints, indexes, Row Level Security, local database tests, and remote migration.

### 13.2 — Authentication UI

**Implemented:** signup, verification handoff, sign-in, recovery/reset, callback, settings, and sign-out. Live email delivery and callback testing still require a deployable preview or merge.

### 13.3 — Cloud adapter

**Implemented on My Progress:** relational load/save/clear mapping, cloud dashboard reconstruction, stable attempt writes, active-session rows, and cloud-aware reset.

### 13.4 — Anonymous import

**Implemented and tested:** explicit import/account-only choice, safe merge, migration record, retry idempotency, and browser backup preservation.

### 13.5 — Privacy and resilience

**Partially complete:** export and cloud-aware reset exist. Remaining work includes secure Auth-account deletion, an offline pending-operation queue, saving/saved/offline/error states, site-wide cloud activation, and multi-device conflict UI.

### 13.6 — Validation

**Remaining:** live signup and email tests, live remote import, second-device sync, conflict testing, and manual desktop/mobile/keyboard/accessibility review.

## Definition of done

Layer 13 is complete when a learner can:

1. create and verify an account;
2. sign in and out securely;
3. import browser progress by choice;
4. continue on another device;
5. resume unfinished cloud sessions;
6. view cloud-backed history;
7. export learning progress;
8. delete account and progress;
9. access only their own database records;
10. use the anonymous local experience without an account.

Layer 13 does not charge users, secure premium files, or grant paid access.