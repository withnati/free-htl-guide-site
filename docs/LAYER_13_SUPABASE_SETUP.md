# Layer 13 — Supabase development setup

## Approved development project

- Project URL: `https://oqbubeklssmlkjjtqczr.supabase.co`
- Project reference: `oqbubeklssmlkjjtqczr`
- Browser configuration: `assets/supabase-config.js`
- JavaScript client: `@supabase/supabase-js` pinned to `2.110.8`

The repository contains only the browser-safe publishable key. Never commit a Supabase secret key, service-role key, database password, personal access token, or direct PostgreSQL connection string.

## Authentication URL configuration

In Supabase Dashboard, open **Authentication → URL Configuration**.

Set the production Site URL to:

```text
https://withnati.github.io/free-htl-guide-site/
```

Add these production redirect URLs:

```text
https://withnati.github.io/free-htl-guide-site/account/auth-callback.html
https://withnati.github.io/free-htl-guide-site/account/reset-password.html
```

For the temporary Layer 13 branch staging review, also add these exact URLs:

```text
https://raw.githack.com/withnati/free-htl-guide-site/layer-13-auth-cloud-progress/account/auth-callback.html
https://raw.githack.com/withnati/free-htl-guide-site/layer-13-auth-cloud-progress/account/reset-password.html
```

The stable branch staging entry points are:

```text
https://raw.githack.com/withnati/free-htl-guide-site/layer-13-auth-cloud-progress/account/sign-up.html?next=../my-progress.html
https://raw.githack.com/withnati/free-htl-guide-site/layer-13-auth-cloud-progress/account/sign-in.html?next=../my-progress.html
https://raw.githack.com/withnati/free-htl-guide-site/layer-13-auth-cloud-progress/my-progress.html
```

For local development, add:

```text
http://127.0.0.1:4173/account/auth-callback.html
http://127.0.0.1:4173/account/reset-password.html
http://localhost:4173/account/auth-callback.html
http://localhost:4173/account/reset-password.html
```

Do not add wildcard callback URLs. Verification and recovery URLs carry short-lived authorization material and should return only to controlled paths. RawGitHack is a temporary Layer 13 staging origin and must be removed from the production Edge Function origin list after the production-hosting transition.

## Email/password settings

In **Authentication → Providers → Email**:

- keep email/password signups enabled;
- keep email confirmation enabled for the development account flow;
- keep secure password recovery enabled;
- do not disable verification merely to simplify testing.

The browser code uses PKCE, persisted sessions, automatic token refresh, and URL session detection.

## Apply the database migration

The source of truth is:

```text
supabase/migrations/20260801000000_layer_13_auth_cloud_progress.sql
```

Preferred deployment methods:

1. Link the local Supabase CLI to the development project and run `supabase db push` using a private developer access token; or
2. Open the migration file, copy the complete transaction into the Supabase SQL Editor, and run it once.

Do not place the access token or database password in repository files or frontend JavaScript.

After deployment, confirm that the following tables exist and have Row Level Security enabled:

- `profiles`
- `module_progress`
- `study_task_progress`
- `learning_attempts`
- `attempt_domain_results`
- `attempt_question_results`
- `active_sessions`
- `active_session_responses`
- `learning_activity`
- `progress_migrations`

## Deploy secure account deletion

Account deletion is implemented in:

```text
supabase/functions/delete-account/index.ts
```

Deploy it from a trusted Supabase CLI session:

```bash
supabase functions deploy delete-account --project-ref oqbubeklssmlkjjtqczr
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the deployed function environment. Do not copy the service-role key into the website, GitHub, chat, or a local browser configuration.

The function:

- accepts only authenticated POST requests from controlled origins;
- requires the exact server confirmation `DELETE MY ACCOUNT`;
- derives the account ID from the verified bearer token;
- never accepts a user ID from the browser request;
- uses the server-only admin client to delete that Auth user;
- relies on database cascade deletion to remove the user’s learner-progress rows.

After deployment, test deletion only with a disposable development account.

## Local verification

```bash
supabase db start
supabase db lint --level warning --fail-on error
supabase test db
supabase functions serve delete-account
```

The repository Database Quality workflow independently applies the migration to a fresh local database and runs the two-user ownership-isolation suite. Site and Browser Quality validate the account deletion boundary and client confirmation flow without using a real service-role credential.

## Current boundary

The development project and account UI do not grant paid access. Layer 13 controls identity and progress ownership only. Protected premium content and server-verified subscription entitlements remain Layer 14 and Layer 15 work.
