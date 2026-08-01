# Layer 14 Environment Separation Plan

**Status:** Implementation plan  
**Architecture:** Cloudflare Pages + Supabase protected delivery  
**Repository baseline:** `405686a2193282d246d2c2878b9bafb015617aea`

## Purpose

Layer 14 introduces controlled local, staging, and production environments without weakening the completed Layer 13 authentication, progress, privacy, conflict, or deletion behavior.

The environments must not share learner data, test accounts, protected content, administrative state, or secret credentials. Authentication proves identity only; premium access continues to require a server-controlled entitlement.

## Environment matrix

| Area | Local development | Preview / staging | Production |
| --- | --- | --- | --- |
| Frontend | Local static server | Cloudflare preview deployment and controlled staging hostname | Cloudflare production deployment on dedicated custom domain |
| Supabase | Local Supabase stack where practical | Separate staging Supabase project | Separate production Supabase project |
| Learner data | Synthetic local data | Staging test accounts only | Real learner accounts only |
| Premium content | Synthetic proof payload | Staging private bucket | Production private bucket |
| Entitlements | Local fixtures | Test grants, expirations, and revocations | Payment- or administrator-controlled records |
| Destructive tests | Allowed | Allowed only for designated staging accounts | Prohibited against real learner accounts |
| Search indexing | Not applicable | `noindex,nofollow`; preview access restricted | Public pages indexable; account and private states remain `noindex,nofollow` |
| Logs | Local console | Staging logs with test identifiers | Production logs with restricted access and retention controls |
| Secrets | Local ignored files or local CLI secret store | Staging provider secret stores | Production provider secret stores |
| Rollback | Reset local state | Redeploy prior preview build and restore test fixtures | Cloudflare deployment rollback plus independent Edge Function/content rollback |

## Required separation rules

1. Production and staging must not use the same Supabase project.
2. Production learner accounts must never be copied into staging.
3. Staging test users must be clearly identifiable and must not use real learner email addresses without consent.
4. Protected staging content must not be copied into public build output.
5. Production service-role keys, database passwords, signing secrets, deployment tokens, and payment secrets must never be used locally or in preview builds.
6. Browser code may contain only the environment's public Supabase URL and browser-safe publishable key.
7. Environment selection must occur during deployment, not through user-editable browser settings, URL parameters, or `localStorage`.
8. No frontend value may grant premium access.
9. Supabase Row Level Security remains enabled in every remote environment.
10. Database migrations must be tested locally, applied to staging, verified, and only then approved for production.

## Hostname plan

Final hostnames require owner approval and domain ownership. The implementation will use placeholders until those values are selected.

| Purpose | Placeholder |
| --- | --- |
| Production website | `https://<production-domain>/` |
| Staging website | `https://staging.<production-domain>/` or another controlled staging hostname |
| Cloudflare branch previews | Cloudflare-generated preview URLs protected from public indexing and, where practical, restricted to reviewers |
| Local website | `http://127.0.0.1:4173/` and/or `http://localhost:4173/` |

The production account experience should not remain on the shared `withnati.github.io` origin. GitHub Pages remains a temporary development rollback reference until the Cloudflare staging and production routes are verified.

## Supabase project model

### Local

Use the Supabase CLI and repository migrations for schema and RLS validation. Local data must be disposable.

### Staging

Create a dedicated staging Supabase project with:

- staging-only Auth users;
- staging-only callback and redirect URLs;
- staging-only entitlement records;
- staging-only private storage bucket;
- staging-only Edge Function secrets;
- staging-only logs;
- test email flows;
- account deletion enabled only for staging test accounts.

### Production

Create a separate production Supabase project with:

- production Auth configuration;
- exact production callback and redirect URLs;
- production learner progress;
- production entitlement records;
- production private storage bucket;
- production-only Edge Function secrets;
- restricted administrative access;
- backup and recovery settings appropriate for a paid service.

The current project at `https://oqbubeklssmlkjjtqczr.supabase.co` is treated as the existing development project until an explicit staging/production assignment is approved. This document does not reclassify it automatically.

## Callback and redirect allowlist

Each Supabase project must use an explicit allowlist. Wildcards should be avoided for production.

Required routes include:

- `/account/auth-callback.html`
- `/account/reset-password.html`
- any future server-rendered callback route approved during implementation

Rules:

- Production callbacks point only to the production domain.
- Staging callbacks point only to the staging domain and controlled preview URLs that are required for testing.
- Local callbacks are permitted only in development and staging projects.
- RawGitHack callback allowances are removed after the controlled staging origin is verified.
- GitHub Pages callback allowances are removed from the production Supabase project before real learner onboarding.
- Redirect destinations remain constrained to the same approved site origin and path boundary.

## CORS and origin handling

Server and Edge Function origin checks must use environment-specific exact allowlists.

### Local allowlist

- `http://127.0.0.1:4173`
- `http://localhost:4173`

### Staging allowlist

- the controlled staging origin;
- approved protected preview origins only when required;
- local origins only when the staging function is intentionally used for manual development testing.

### Production allowlist

- the exact production origin;
- no RawGitHack origin;
- no general Cloudflare preview wildcard;
- no broad GitHub Pages origin;
- no reflected arbitrary origin.

Origin checks supplement authentication and entitlement checks. They are not a replacement for either.

## Environment variables

### Browser-safe variables

These values may be included in the frontend build for the corresponding environment:

- `FHL_PUBLIC_SITE_URL`
- `FHL_SUPABASE_URL`
- `FHL_SUPABASE_PUBLISHABLE_KEY`
- `FHL_ENVIRONMENT`
- approved analytics identifiers, if consent controls remain intact

A publishable key does not grant privileged database access. RLS and server authorization remain mandatory.

### Server-only variables

These values must never enter browser bundles, generated HTML, public logs, screenshots, documentation examples with real values, or Git history:

- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase secret key
- database password or direct privileged database URL
- private signing secret
- deployment access token
- Cloudflare API token
- payment-provider secret key
- payment webhook signing secret
- administrative override secret

Server-only variables belong in Supabase Edge Function secrets, Cloudflare secret bindings, or another approved server-side secret manager.

## Repository files

Committed files may contain:

- `.env.example` with variable names and non-secret placeholders;
- environment documentation;
- validation scripts that check for required variable names;
- deployment configuration without credentials;
- public URLs only after they are approved.

Ignored files must include:

- `.env`
- `.env.*` except `.env.example`
- local Supabase state
- downloaded deployment credentials
- test output containing tokens

## Deployment flow

### Pull request

1. Push an incremental commit to the Layer 14 branch.
2. Run Site Quality, Browser Quality, Database Quality when applicable, and Layer 14 Security checks.
3. Generate a Cloudflare preview deployment.
4. Confirm the preview uses staging configuration only.
5. Perform targeted desktop, mobile, accessibility, callback, denial, and entitlement tests.
6. Record evidence in the draft pull request.

### Staging

1. Merge or promote an explicitly selected commit to the staging deployment target without changing production.
2. Apply migrations to staging after local database checks pass.
3. Deploy staging Edge Functions.
4. Upload only proof or approved staging content to the staging private bucket.
5. Run the complete protected-delivery verification matrix.
6. Verify rollback before production approval.

### Production

Production release is a separate approval gate:

1. Confirm exact approved commit SHA.
2. Confirm all automated checks and staging evidence.
3. Back up or confirm recoverability of production data.
4. Apply reviewed additive migrations.
5. Deploy reviewed Edge Function version.
6. Deploy the frontend.
7. Run production smoke tests using designated accounts.
8. Confirm callbacks, denial states, entitled access, revocation, logging, and rollback readiness.

## Logging boundaries

Logs may contain:

- request ID;
- content ID;
- authorization decision category;
- response status;
- environment;
- function version;
- latency;
- a pseudonymous or internal user identifier when operationally necessary.

Logs must not contain:

- bearer tokens;
- refresh tokens;
- passwords;
- service-role or secret keys;
- complete protected payloads;
- answer keys or explanations;
- signed URLs beyond what is strictly necessary;
- personal notes;
- unnecessary email addresses.

## Test-account controls

- Maintain designated signed-out, free, trial, premium, expired, revoked, and administrative staging cases.
- Use fixed test account roles but rotate credentials when exposure is suspected.
- Do not reuse personal production passwords.
- Do not place credentials in browser tests committed to the repository.
- CI tests should use local or controlled ephemeral fixtures whenever possible.
- Manual staging credentials must be stored outside GitHub and project documentation.

## Destructive testing

Allowed locally and in staging for designated test accounts:

- account deletion;
- entitlement revocation;
- progress reset;
- failed migration simulation;
- private-object replacement;
- token expiration and invalidation tests.

Production destructive tests require an explicit incident or release procedure and must never target real learner accounts casually.

## Temporary-origin retirement checklist

Before directing real learners to the production signup flow:

- [ ] Production domain and TLS verified.
- [ ] Staging domain verified.
- [ ] Production Supabase callback URLs limited to the production domain.
- [ ] Staging callback URLs separated from production.
- [ ] RawGitHack removed from Edge Function origin allowlists.
- [ ] RawGitHack removed from Supabase redirect URLs.
- [ ] GitHub Pages removed from production callback and CORS allowlists.
- [ ] Local origins absent from production server allowlists unless a documented exception is approved.
- [ ] Account deletion, password reset, signup verification, and safe redirects retested.
- [ ] Production smoke-test evidence recorded.

## Decisions still requiring owner input

Implementation can continue without these values, but external resource creation or production configuration must pause until they are approved:

1. Production domain or subdomain.
2. Staging hostname strategy.
3. Whether the existing Supabase project remains development-only or becomes staging.
4. Creation and billing approval for a separate production Supabase project.
5. Creation of the Cloudflare account/project connection if not already available.
6. Repository visibility change timing.

No secret value should be supplied in chat or committed to GitHub.