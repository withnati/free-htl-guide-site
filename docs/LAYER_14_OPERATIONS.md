# Layer 14 Deployment and Operations Guide

**Status:** Repository procedure complete; Cloudflare and remote Supabase execution pending  
**Applies to:** Preview/staging and production hosting, entitlement delivery, private content, and Layer 13 account continuity

## Operating principles

1. Production changes require an exact approved commit SHA.
2. Every database migration is tested locally, then in staging, before production.
3. Staging and production use separate Supabase projects and separate learner data.
4. The public site is deployed from a generated allowlisted output directory, never directly from the repository root.
5. Premium content is uploaded directly to private storage and is never placed in the public build or Git history.
6. Frontend deployment, database migration, Edge Function deployment, and protected-object publication are separate release actions with separate rollback paths.
7. Authentication proves identity only; entitlement is checked on every protected-content request.
8. No secret value is copied into GitHub issues, pull-request descriptions, screenshots, repository files, or chat.
9. A failed security or availability check blocks promotion. Tests are corrected rather than weakened.
10. Production is not merged or deployed without explicit owner approval.

## Roles and ownership

Until a larger team is approved, the repository owner is the release owner and final approver.

| Responsibility | Owner |
| --- | --- |
| Architecture and product approval | Repository owner |
| Pull-request implementation and evidence | Layer implementer |
| Database migration review | Repository owner plus technical reviewer when available |
| Staging deployment | Authorized operator |
| Production deployment | Authorized operator after explicit approval |
| Secret management | Repository owner / authorized operator |
| Incident coordination | Repository owner |
| Educational-content approval | Scientific/editorial reviewer |

No contributor receives production secrets merely because they can contribute code.

## Release units

Treat these as separate artifacts:

1. **Frontend build** — public pages, account shells, premium preview shells, client runtimes, public assets, `_headers`, sitemap, and robots configuration.
2. **Database migration** — learner-progress or entitlement schema changes.
3. **Edge Functions** — `delete-account`, `premium-content`, and future server operations.
4. **Protected objects** — private lesson packages, question payloads, explanations, answer keys, and downloads.
5. **Environment configuration** — public frontend variables, exact callback URLs, exact origins, and server secrets.

A release may update one or more units, but each unit must be identified in the pull request and rollback plan.

## Pull-request and preview process

1. Start from the current `main` branch.
2. Work on the dedicated Layer 14 branch.
3. Keep PR #19 in draft.
4. Commit incrementally with specific messages.
5. Update the PR description with implemented work, security decisions, automated evidence, manual evidence, and remaining work.
6. Require these workflows:
   - Site Quality;
   - Browser Quality;
   - Database Quality when database files change;
   - Layer 14 Security;
   - future public-build output validation.
7. Connect the private repository to Cloudflare Pages only after repository visibility and account ownership are approved.
8. Configure the Pages build command to generate `dist/` and use `dist/` as the output directory.
9. Use Cloudflare preview deployments for pull-request review.
10. Protect preview access with Cloudflare Access where practical.
11. Confirm preview responses include `X-Robots-Tag: noindex` and that private/account pages remain `noindex,nofollow`.
12. Never place production learner data or production server secrets in a preview environment.

## Cloudflare Pages configuration target

The future Cloudflare project should use:

- Git integration with the approved private repository;
- production branch: `main` only after production readiness;
- preview branches limited to approved development branches;
- build command: the repository's allowlisted public-build command;
- output directory: `dist`;
- no deployment from the repository root;
- security headers from `dist/_headers`;
- custom production domain after DNS and ownership approval;
- controlled staging hostname or branch alias;
- deployment retention sufficient for rollback.

Cloudflare injects build metadata such as the commit SHA and branch. These values may be used for release identification but must not change entitlement behavior.

## Frontend environment variables

Only browser-safe values may be used during the public build:

- `FHL_ENVIRONMENT`
- `FHL_PUBLIC_SITE_URL`
- `FHL_SUPABASE_URL`
- `FHL_SUPABASE_PUBLISHABLE_KEY`
- approved consent-gated analytics identifiers

The build must fail when required production public values are missing rather than silently falling back to development URLs.

## Supabase migration process

### Local verification

```bash
supabase db start
supabase db lint --level warning --fail-on error
supabase test db
supabase stop --no-backup
```

Expected result:

- all migrations apply to a fresh local stack;
- database lint has no schema errors;
- all Layer 13 RLS assertions pass;
- all Layer 14 entitlement tests pass;
- no browser role can mutate entitlement records;
- the premium bucket is private.

### Staging migration

1. Confirm the target project reference is the staging project.
2. Confirm the operator is not linked to production accidentally.
3. Review the migration diff and exact commit SHA.
4. Apply the migration using the approved Supabase CLI/database deployment process.
5. Verify tables, functions, grants, RLS, triggers, and storage bucket settings.
6. Run staging access tests with designated accounts.
7. Record migration time, operator, commit, and result in PR #19.

### Production migration

1. Obtain explicit approval.
2. Confirm production backup/recovery status.
3. Confirm staging passed on the same migration and exact commit.
4. Apply additive migrations before deploying frontend code that depends on them.
5. Stop the release on any migration error.
6. Do not modify or delete the migration file after it has been applied remotely; use a new forward-fix migration.

## Edge Function deployment

### Staging

```bash
supabase functions deploy premium-content --project-ref <staging-project-ref>
supabase functions deploy delete-account --project-ref <staging-project-ref>
```

Before deployment:

- set exact staging origins;
- verify the private bucket name;
- confirm service-role and platform secrets are managed by Supabase;
- confirm the function source contains no production hardcoded origin or secret.

After deployment:

- signed-out request returns `401`;
- free account returns `403 upgrade_required`;
- entitled account returns `200`;
- revoked account returns `403` on the next request;
- incorrect origin returns `403` without a permissive CORS response;
- logs contain request IDs and decisions but no tokens or payloads.

### Production

Deploy only the reviewed function version from the exact approved commit. Production function deployment is a separate explicit approval step even after the pull request is merged.

## Function secret management

Server-only values are set through Supabase secret management or the provider dashboard.

Examples of variable names:

- `FHL_ALLOWED_ORIGINS`
- `FHL_PREMIUM_BUCKET`
- future payment-provider secret variables

Rules:

- use exact origins separated by commas;
- never use `*`;
- do not include RawGitHack in production;
- do not include GitHub Pages in production after the custom-domain cutover;
- do not include local origins in production without a documented exception;
- do not commit `.env` files;
- verify secret names with `supabase secrets list` without printing values;
- rotate immediately after suspected exposure.

## Protected-object publishing

1. Scientific/editorial review must be complete for content marketed as reviewed.
2. Create the protected object outside the public repository.
3. Add a unique leakage-test canary known to the release process.
4. Validate the payload schema locally without copying the payload into committed tests.
5. Upload directly to the correct environment's private bucket.
6. Verify the bucket is private.
7. Verify direct object URLs fail.
8. Add or update the server content allowlist only through reviewed code.
9. Test authorization before announcing availability.
10. Retain the prior object version until rollback is no longer required.

Do not overwrite a working production object in place when a versioned content ID can be used instead.

## Production deployment order

Recommended order for a release that adds a new protected package:

1. Confirm exact approved commit and green workflows.
2. Confirm database recovery readiness.
3. Apply additive database migration.
4. Deploy the Edge Function version that understands the new content ID.
5. Upload the protected object to private storage.
6. Test the endpoint directly with designated production smoke-test accounts.
7. Deploy the public frontend shell.
8. Verify callbacks, account state, denial states, entitled delivery, and revocation.
9. Record deployment and smoke-test evidence.
10. Keep the release under observation before closing the milestone.

This order avoids a public link that points to an unavailable authorization backend.

## Production smoke tests

### Public and account shell

- [ ] Homepage loads over TLS.
- [ ] Public Fixation lesson loads.
- [ ] Premium routes contain only preview/access shells.
- [ ] Public build contains no premium canary or private object path.
- [ ] Signup opens the production callback flow.
- [ ] Verification email returns to the production domain.
- [ ] Sign-in persists correctly.
- [ ] Password reset returns to the production domain.
- [ ] Account settings work.
- [ ] Anonymous progress remains local.
- [ ] Cloud import and account-only modes work.
- [ ] Cross-device synchronization works.
- [ ] Conflict handling remains explicit.
- [ ] Account deletion works from the production origin.

### Protected content

- [ ] Signed out: `401` and sign-in state.
- [ ] Signed in/free: `403 upgrade_required`.
- [ ] Active premium: `200` and correct payload.
- [ ] Expired: `403`.
- [ ] Revoked: `403` immediately on the next request.
- [ ] Invalid token: `401`.
- [ ] Incorrect origin: `403`.
- [ ] Direct storage request: denied.
- [ ] `localStorage`, profile metadata, and URL edits: no effect.
- [ ] Mobile and desktop render without horizontal overflow.
- [ ] Keyboard focus and screen-reader status are understandable.

### Headers and indexing

- [ ] TLS is valid.
- [ ] HSTS is enabled only after successful domain verification.
- [ ] CSP is present and functional.
- [ ] `X-Content-Type-Options: nosniff` is present.
- [ ] `Referrer-Policy` is present.
- [ ] `Permissions-Policy` is present.
- [ ] Preview deployments return `X-Robots-Tag: noindex`.
- [ ] Account and proof pages remain `noindex,nofollow`.
- [ ] Public sitemap contains only approved indexable pages.

## Rollback procedures

### Frontend rollback

Use Cloudflare Pages to promote the last known-good deployment. Confirm the rollback SHA and rerun public/account smoke tests.

### Edge Function rollback

Redeploy the last known-good function source. If authorization behavior is uncertain, disable the content ID in the allowlist or revoke the affected product entitlement before restoring access.

### Protected-object rollback

Point the server allowlist to the prior versioned object. Do not make the bucket public. Remove the defective object only after traffic has moved away from it.

### Database rollback

Prefer additive forward fixes. Do not perform destructive down-migrations against learner or entitlement data during an ordinary rollback. If a migration creates an unsafe authorization state, deny protected delivery first, then apply a reviewed forward fix.

### Emergency access shutdown

1. Revoke affected entitlements or remove the content ID from the allowlist.
2. Deploy the denial-safe function version.
3. Confirm protected requests fail closed.
4. Preserve logs and audit history.
5. Notify affected learners only after facts and scope are verified.

## Incident response

### Severity examples

- **Critical:** premium content publicly accessible, service-role or signing secret exposed, cross-user learner data access, unauthorized entitlement grant.
- **High:** protected endpoint bypass, widespread invalid access, account deletion authorization defect, production callback takeover.
- **Moderate:** incorrect denial/entitlement status, unavailable premium content, broken production callback without data exposure.
- **Low:** isolated display or accessibility defect without authorization impact.

### Initial response

1. Stop active deployment or promotion.
2. Fail closed: disable protected delivery if authorization integrity is uncertain.
3. Revoke exposed credentials and provider access.
4. Preserve logs, commit SHAs, deployment IDs, request IDs, and timestamps.
5. Determine affected environments, users, content IDs, and time window.
6. Avoid speculative public statements.
7. Apply and test a corrective change in staging.
8. Obtain approval before restoring production access.
9. Document root cause, impact, correction, and prevention.

## Secret rotation

Rotate a secret when:

- it appears in Git history, a screenshot, issue, chat, browser bundle, or public log;
- an operator or integration no longer requires access;
- a device or account may be compromised;
- provider guidance requires rotation;
- an incident investigation cannot establish confidentiality.

Rotation sequence:

1. Create the replacement in the provider secret manager.
2. Update the dependent server environment.
3. Deploy or reload if required.
4. Verify service operation.
5. Revoke the prior secret.
6. Review logs for misuse.
7. Remove exposed material where possible without claiming historical erasure.

## Access revocation

- Remove former collaborators from GitHub, Cloudflare, Supabase, email, analytics, and payment-provider access.
- Revoke deployment tokens and personal access tokens.
- Rotate shared secrets; avoid long-lived shared credentials.
- Review repository branch protection and environment access.
- Confirm the person cannot access production logs or private content.

## Log review and monitoring

Review:

- protected-function error rate;
- `401`, `403`, `404`, `503`, and `200` proportions;
- unexpected origin-denied spikes;
- entitlement check failures;
- private-object failures;
- repeated unknown content IDs;
- account deletion failures;
- authentication callback errors;
- deployment failures and rollbacks;
- database migration and RLS test results.

Logs must not contain tokens, passwords, protected payloads, complete answer keys, service credentials, or unnecessary email addresses.

Create alerts after production tooling is selected for:

- unusual increase in protected `200` volume;
- authorization failure spike;
- sustained `503` responses;
- function deployment failure;
- database availability or migration failure;
- secret/configuration changes;
- custom-domain or TLS failure.

## Database backups and recovery

Before a paid launch:

- confirm the production plan's automated backup behavior;
- document retention and restore expectations;
- test recovery using a non-production environment;
- understand the boundary between database backups, Auth data, Storage objects, and external payment records;
- maintain versioned protected content separately from database recovery;
- do not describe backup as verified until a restore procedure has been exercised.

## Release record

For every production release, record:

- date and time;
- operator;
- approved PR and exact head SHA;
- squash merge commit;
- Cloudflare deployment ID;
- Supabase project reference by environment;
- migrations applied;
- Edge Functions deployed;
- protected content IDs published;
- smoke-test accounts used without recording passwords;
- automated and manual results;
- rollback target;
- known limitations.

## Current execution boundary

This guide does not create a Cloudflare project, change repository visibility, choose a domain, create a production Supabase project, apply remote migrations, deploy Edge Functions, upload premium content, or change production callbacks. Those actions require owner involvement and controlled provider access.
