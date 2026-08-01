# Layer 14 Architecture Decision

**Status:** Approved for implementation planning  
**Decision date:** August 1, 2026  
**Repository baseline:** `405686a2193282d246d2c2878b9bafb015617aea`  
**Branch:** `layer-14-production-protected-delivery`  
**Milestone:** Layer 14 — production hosting and protected premium-content delivery

## Decision

Use the following production architecture:

- **Cloudflare Pages** for the public website, account pages, preview deployments, production deployments, custom domains, TLS, rollback, security headers, and edge delivery.
- **Supabase Auth** for verified learner identity and sessions.
- **Supabase PostgreSQL** for normalized learner progress and server-controlled entitlement records.
- **Supabase Edge Functions** for authenticated, server-side entitlement checks before premium content is delivered.
- **Private Supabase Storage** for premium lessons, question-bank payloads, explanations, answer keys, and protected downloads.
- **Stripe or another payment provider later in Layer 15**, with payment webhooks updating server-controlled entitlement state.

Authentication proves identity only. It does not grant premium access.

## Security boundary

The browser may receive public pages, free learning content, account interfaces, upgrade states, and non-sensitive content identifiers.

The browser must not receive protected premium content unless a server or edge function has:

1. validated the Supabase session;
2. derived the authenticated user from the verified token;
3. checked a server-controlled, non-user-editable entitlement;
4. validated the requested content identifier against an allowlist; and
5. authorized delivery from private storage.

The following may never grant premium access:

- `localStorage` or `sessionStorage` values;
- URL parameters;
- hidden HTML or CSS;
- disabled buttons;
- frontend route checks;
- user-editable profile metadata;
- public JSON flags;
- publicly deployed premium files.

Service-role credentials, private signing secrets, database passwords, deployment tokens, and payment webhook secrets remain server-only.

## Preserved Layer 13 decisions

- The central progress-service contract remains the page-level interface.
- Anonymous learners may continue using local browser progress for the free experience.
- Cloud progress remains normalized and protected by Row Level Security.
- Completed attempts remain stable and idempotent.
- Mutable sessions continue using revisions and explicit conflict handling.
- Cloud progress does not contain full question text, explanations, answer keys, or personal notes.
- Imports, exports, resets, and deletion remain explicit, allowlisted user actions.
- Existing account, privacy, progress, and security behavior may not be weakened to simplify hosting.

## Current exposure finding

The existing GitHub Pages development build contains premium-designated lessons, quizzes, question-bank material, explanations, answer keys, mock-exam code, Targeted Practice, and protected-download candidates as publicly retrievable repository and deployment files.

The current `data/content-access.json` classification is metadata only and is not authorization. `noindex,nofollow`, hidden interfaces, or client-side conditions do not protect those files.

Existing public material must be treated as development-preview content. Revised or newly created premium launch assets must remain outside public build output and must be delivered only after server authorization.

## Environment model

### Local development

- Local frontend and Supabase services.
- Local callback URLs and CORS origins.
- Local test users and non-production data.
- No production secrets.
- Destructive tests permitted only against local resources.

### Preview or staging

- Cloudflare preview deployments or a controlled staging domain.
- Separate staging Supabase project recommended.
- Staging-only callback URLs, CORS origins, storage buckets, entitlements, test users, and logs.
- `noindex,nofollow` and reviewer access controls.
- Destructive testing limited to staging test accounts.

### Production

- Dedicated custom domain.
- Separate production Supabase project recommended.
- Exact production callback URLs and allowed origins.
- Production-only secrets, learner records, storage, logs, and backups.
- No destructive testing with real learner accounts.

Temporary RawGitHack callback and origin allowances must be removed after controlled staging and production origins are verified.

## Initial protected-delivery proof

The first proof will use one small, revised premium content package rather than migrating the full curriculum.

The proof must demonstrate:

- signed-out users receive `401`;
- signed-in free users receive `403` and an accessible upgrade-required state;
- entitled users receive the protected payload;
- revoking entitlement removes access;
- expired or invalid sessions fail safely;
- direct private-storage URL guessing fails;
- public source and build output do not contain the protected payload;
- browser-storage or URL-parameter edits cannot bypass authorization;
- incorrect origins are denied;
- server errors do not expose credentials, tokens, private paths, or protected content.

## Planned entitlement foundation

The entitlement model must support at least:

- free;
- trial;
- premium;
- grace period;
- expired;
- canceled with paid-through access where applicable;
- revoked;
- administrative access; and
- future institutional access.

Entitlements must be tied to the authenticated user, server-controlled, auditable, revocable, non-user-editable, safely cached, and checked before protected delivery.

Layer 14 will establish the entitlement and delivery foundation. Checkout, billing portals, and production payment webhooks remain primarily Layer 15 scope.

## Repository and deployment controls

Layer 14 will add or update:

- an environment matrix and setup documentation;
- a public-versus-protected content inventory;
- deterministic dependency installation using a committed lockfile and `npm ci`;
- Cloudflare preview and production deployment configuration;
- security headers;
- entitlement migrations and database tests;
- a protected-content Edge Function or equivalent secure endpoint;
- private storage configuration;
- public-build leakage scanning;
- secret scanning and protected-content canaries;
- desktop, mobile, accessibility, origin, token, revocation, and failure-path tests;
- deployment, rollback, incident-response, secret-rotation, access-revocation, monitoring, and smoke-test procedures.

## Pull-request rules

- This Layer 14 pull request begins as a draft.
- Implementation will use incremental, clearly named commits.
- The pull-request description will track implemented work, security decisions, tests, remaining work, and manual verification.
- Site Quality, Browser Quality, Database Quality, and new Layer 14 security checks must pass.
- Staging, desktop, mobile, accessibility, and protected-delivery behavior must be manually reviewed.
- No merge or production deployment may occur without explicit owner approval.
- The exact approved head SHA must be verified before a squash merge.

## Major risks

1. Existing premium-designated content is already public and cannot be made historically secret merely by deleting current files.
2. A public repository or public build could accidentally expose future protected content.
3. Development, staging, and production Supabase configuration could be mixed.
4. Entitlement caching could delay revocation.
5. Private storage paths or signed URLs could be exposed through unsafe responses or logs.
6. Layer 15 payment events may arrive more than once or out of order and will require idempotent processing.
7. Migration away from GitHub Pages could regress account callbacks, anonymous progress, synchronization, conflict handling, or deletion.

These risks will be addressed through private-source controls, separated environments, allowlisted delivery, short-lived authorization, automated leakage tests, staging verification, and preserved Layer 13 regression coverage.

## Approval boundary

This decision authorizes the Layer 14 branch, documentation, draft pull request, staging architecture, and incremental implementation planning.

It does not authorize:

- merging the Layer 14 pull request;
- deploying production changes;
- enabling paid access;
- adding checkout or billing;
- migrating the full curriculum;
- deleting the GitHub Pages rollback deployment; or
- exposing any secret credential.
