# Supabase development

This directory is the source of truth for Layer 13 database changes.

## Current status

The repository contains the initial authentication-linked cloud-progress migration. No remote Supabase project or production credentials are committed.

## Local setup

Install the current Supabase CLI, then initialize local configuration if `supabase/config.toml` is not present:

```bash
supabase init
supabase start
supabase db reset
```

`supabase db reset` rebuilds the local database and replays every file in `supabase/migrations/`.

Useful checks:

```bash
supabase db lint
supabase test db
supabase status
```

## Remote environments

Do not link this repository to a production project until the Layer 13 schema and Row Level Security tests pass locally.

When development and staging projects exist:

```bash
supabase login
supabase link --project-ref <development-project-ref>
supabase db push
```

Keep development, staging, and production projects separate. Do not make undocumented schema changes in the Supabase Dashboard. Database changes must be represented by committed migration files.

## Secrets

Never commit:

- database passwords;
- secret or service-role keys;
- access tokens;
- SMTP credentials;
- production project secrets.

The project URL and browser-safe publishable key may later be exposed through a public runtime configuration file, but they do not replace Row Level Security. Secret keys must remain in trusted server or Edge Function environments.

## Security contract

Every learner-owned table must enable Row Level Security and bind ownership to `auth.uid()`. Anonymous database access is denied. The browser must never be able to read or write another learner's records.

Completed progress stores stable IDs and outcomes only. Question text, explanations, answer keys, personal notes, email addresses, theme preference, and analytics-consent state are excluded from cloud progress.
