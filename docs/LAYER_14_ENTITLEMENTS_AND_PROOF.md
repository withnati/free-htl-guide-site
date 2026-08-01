# Layer 14 Entitlement and Protected-Delivery Proof

**Status:** Repository implementation complete; remote deployment and live proof pending  
**Product code used by the proof:** `fhl-premium`  
**Protected content ID:** `processing-proof-v1`  
**Private bucket:** `premium-content`

## Purpose

This document describes the first server-controlled entitlement foundation and protected premium-content endpoint. It does not authorize a production deployment, payment processing, or migration of the complete curriculum.

## Database foundation

Migration:

`supabase/migrations/20260801060000_layer_14_entitlements.sql`

The migration adds:

- `public.entitlements` — one current entitlement record per learner and product;
- `public.entitlement_events` — append-only audit events generated when an entitlement is created or updated;
- `public.has_effective_entitlement(...)` — server-only decision function;
- the private `premium-content` storage bucket.

### Supported entitlement states

- `free`
- `trial`
- `premium`
- `grace`
- `canceled`
- `expired`
- `revoked`
- `administrative`
- `institutional`

### Effective-access behavior

Access is granted when:

- the record belongs to the authenticated user being checked;
- the product code matches;
- `valid_from` has begun;
- the record is not revoked; and
- the state and date window are effective.

State behavior:

| State | Effective access |
| --- | --- |
| `free` | No |
| `trial` | Yes until `valid_until`, or indefinitely only when an approved trial record intentionally has no end |
| `premium` | Yes until `valid_until`, or indefinitely when no end is set |
| `grace` | Yes only until `grace_until` |
| `canceled` | Yes only through `valid_until` or `grace_until` |
| `expired` | No |
| `revoked` | No, immediately |
| `administrative` | Yes while its optional date window remains effective |
| `institutional` | Yes while its optional date window remains effective |

Layer 15 payment logic will later determine how provider events create or update these records. Browser return URLs may never update them.

## Database security

- Row Level Security is enabled on both entitlement tables.
- `anon` and `authenticated` receive no direct table privileges.
- Learners cannot insert, update, delete, or directly read entitlement records.
- Learners cannot directly execute `has_effective_entitlement`.
- Only the server-side `service_role` may execute the effective-access function.
- Entitlement audit events are created by a security-definer trigger.
- The service-role credential remains server-only.

The frontend may receive a minimal entitlement outcome through an approved server response, but the frontend outcome is not itself authorization for another request.

## Protected endpoint

Function:

`supabase/functions/premium-content/index.ts`

The endpoint accepts authenticated `POST` requests with:

```json
{
  "contentId": "processing-proof-v1"
}
```

The server allowlist maps that non-sensitive identifier to:

- the required product code;
- the private object path;
- the response content type.

The caller never supplies the bucket name, storage object path, user ID, product code, or entitlement state.

## Request decision sequence

1. Require an exact configured origin.
2. Allow only `POST` and controlled `OPTIONS` preflight.
3. Require a bearer token.
4. Validate the token through Supabase Auth.
5. Derive the user ID from the verified token.
6. Parse the requested content ID.
7. Resolve the content ID through the server allowlist.
8. Use the service role to call the server-only entitlement decision function.
9. Return `403 upgrade_required` when entitlement is not effective.
10. Download the allowlisted object from the private bucket with the service role.
11. Return the payload with private, no-store caching and security headers.

## Response states

| Condition | HTTP status | Learner experience |
| --- | ---: | --- |
| Origin missing or not allowed | 403 | Request blocked; no content |
| Unsupported method | 405 | Safe method error |
| Missing token | 401 | Sign-in required |
| Invalid or expired token | 401 | Session expired; sign in again |
| Invalid JSON | 400 | Retry request |
| Unknown content ID | 404 | Content unavailable |
| Signed-in but unentitled | 403 | Accessible upgrade-required state |
| Entitlement/database failure | 503 | Temporary problem; do not mislabel as free access |
| Private object unavailable | 503 | Temporary problem; no path disclosure |
| Effective entitlement | 200 | Protected payload delivered |

## Security headers

The proof endpoint returns:

- `Cache-Control: private, no-store`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`
- `Cross-Origin-Resource-Policy: same-site`
- `Referrer-Policy: no-referrer`
- `Vary: Origin, Authorization`
- `X-Content-Type-Options: nosniff`

The endpoint does not return signed URLs in the initial proof. This keeps the first implementation simple and makes revocation behavior easier to verify.

## Logging

The function logs only:

- request ID;
- status code;
- decision category;
- content ID when available.

It must not log:

- bearer or refresh tokens;
- email addresses;
- service-role keys;
- protected payloads;
- answer keys or explanations;
- private storage errors containing sensitive path details.

## Required remote secrets

Set through Supabase Function secrets, never GitHub or browser code:

- `FHL_ALLOWED_ORIGINS` — comma-separated exact staging origins during the proof;
- `FHL_PREMIUM_BUCKET` — normally `premium-content`;
- the platform-provided `SUPABASE_URL`;
- the platform-provided browser-safe `SUPABASE_ANON_KEY`;
- the platform-provided `SUPABASE_SERVICE_ROLE_KEY`.

Do not paste real values into issues, pull-request comments, documentation, screenshots, or chat.

## Proof content handling

The actual proof payload is intentionally not committed to the current public repository.

Before upload it should:

- be a small revised Processing learning package;
- contain no real learner data;
- contain a unique leakage-test canary chosen outside public source control;
- be uploaded directly to the staging private bucket at the allowlisted path;
- use `application/json`;
- remain absent from public Git history and Cloudflare public build output.

## Staging deployment sequence

1. Create or approve the staging Supabase project.
2. Apply all migrations to a fresh local database and pass Database Quality.
3. Apply the migration to staging.
4. Verify the `premium-content` bucket is private.
5. Deploy the `premium-content` Edge Function.
6. Set exact staging origins through function secrets.
7. Upload the proof payload directly to private storage.
8. Create designated free, premium, expired, and revoked staging accounts.
9. Grant entitlement only through controlled SQL or a future server-only administrative operation.
10. Run the complete verification matrix.

## Manual entitlement examples

These examples are operator templates only. Replace placeholders inside the controlled Supabase SQL environment, never in committed files.

Grant temporary staging premium access:

```sql
insert into public.entitlements (
  user_id,
  product_code,
  status,
  valid_until,
  source,
  source_reference
)
values (
  '<verified-staging-user-id>',
  'fhl-premium',
  'premium',
  statement_timestamp() + interval '1 day',
  'manual-staging-proof',
  'layer-14-proof'
)
on conflict (user_id, product_code) do update
set
  status = excluded.status,
  valid_from = statement_timestamp(),
  valid_until = excluded.valid_until,
  grace_until = null,
  canceled_at = null,
  revoked_at = null,
  source = excluded.source,
  source_reference = excluded.source_reference;
```

Revoke immediately:

```sql
update public.entitlements
set
  status = 'revoked',
  revoked_at = statement_timestamp(),
  source = 'manual-staging-proof',
  source_reference = 'layer-14-revocation'
where user_id = '<verified-staging-user-id>'
  and product_code = 'fhl-premium';
```

These operations must be performed only in local or staging environments until production administration is separately approved.

## Verification matrix

- [ ] Signed out receives `401`.
- [ ] Invalid token receives `401`.
- [ ] Expired token receives `401`.
- [ ] Signed-in free learner receives `403 upgrade_required`.
- [ ] Active trial receives `200`.
- [ ] Active premium receives `200`.
- [ ] Canceled but still paid-through receives `200` until the end time.
- [ ] Grace access receives `200` until `grace_until`.
- [ ] Expired access receives `403`.
- [ ] Revoked access receives `403` on the next request.
- [ ] Administrative access works when deliberately granted.
- [ ] Institutional access works when deliberately granted.
- [ ] Unknown content ID receives `404` after authentication.
- [ ] Incorrect origin receives `403` without an allow-origin header.
- [ ] Direct storage URL cannot retrieve the object.
- [ ] Editing local storage has no effect.
- [ ] Editing profile metadata has no effect.
- [ ] Adding URL parameters has no effect.
- [ ] Public source and build output contain neither the payload nor its canary.
- [ ] Server failures return generic `503` responses.
- [ ] Desktop, mobile, keyboard, and screen-reader states are reviewed.

## Rollback

The proof can be disabled without deleting learner progress by:

1. revoking or expiring proof entitlements;
2. removing the content ID from the server allowlist;
3. rolling the Edge Function back to the prior version;
4. removing the private object after access has been disabled;
5. rolling back the frontend shell independently.

Do not delete entitlement audit history during routine rollback.

## Current boundary

Repository implementation is not the same as a verified live deployment. The proof remains incomplete until:

- the migration passes local Database Quality;
- the function is deployed to the approved staging project;
- a private payload is uploaded outside the public repository;
- staging accounts complete the full verification matrix;
- evidence is recorded in draft PR #19.
