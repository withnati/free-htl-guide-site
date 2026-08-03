# Live Billing Launch Readiness

**Last reviewed:** August 3, 2026  
**Current decision:** Sandbox validated; live charging remains blocked.

This record is the operational gate for enabling real Stripe payments. It supplements the architecture and security requirements in `LAYER_16_9_PHASE_B_STRIPE_SETUP.md`.

## Verified in the Stripe sandbox

- [x] Monthly checkout displays and charges $9.99.
- [x] Annual checkout displays and charges $99.99.
- [x] A successful verified webhook grants Premium.
- [x] The account subscription page reads server-controlled status.
- [x] The Stripe Customer Portal opens for the authenticated learner.
- [x] Payment-method management is available.
- [x] Cancellation is configured for the end of the paid period.
- [x] Invoice history is available.
- [x] Checkout, portal, and subscription-status functions require a verified learner session.
- [x] The webhook endpoint requires a valid Stripe signature and does not require a Supabase JWT.
- [x] Duplicate webhook event IDs are idempotent.
- [x] Stale subscription events are retained and ignored.
- [x] Renewal and payment-failure event paths are implemented.
- [x] Full-refund and dispute paths revoke Premium; partial refunds require explicit review.
- [x] Existing billable or paid-through subscriptions cannot open another checkout.
- [x] Stripe sandbox destination listens to the eight supported event types.

## Required sandbox lifecycle evidence still pending

- [ ] Exercise an actual renewal and verify the new period and audit record.
- [ ] Exercise a declined renewal and verify the configured grace policy.
- [ ] Cancel at period end and verify access remains through the paid-through date.
- [ ] Verify expiration removes Premium after the paid-through date.
- [ ] Apply a full sandbox refund and verify immediate revocation.
- [ ] Generate a sandbox dispute and verify immediate revocation.
- [ ] Confirm a partial refund does not silently revoke or extend access.
- [ ] Redeliver the same event and verify a duplicate ledger result.
- [ ] Deliver an older subscription event and verify an `ignored_stale` result.
- [ ] Verify signed-out, wrong-user, and direct Premium-route denial on desktop and mobile.
- [ ] Review `billing_events`, `billing_subscriptions`, `entitlements`, and `billing_audit_log` after every lifecycle case.

## Owner-only live-account blockers

- [ ] Complete Stripe business verification using the legal owner or business identity.
- [ ] Complete the Stripe public business profile.
- [ ] Add and verify the payout bank account.
- [ ] Complete applicable tax and identity requirements.
- [ ] Approve the customer-facing statement descriptor, support contact, refund policy, and cancellation terms.
- [ ] Select and approve the production custom domain.

Identity documents, bank information, tax identifiers, passwords, one-time codes, Stripe secret keys, and webhook signing secrets must never be placed in source control, issues, logs, screenshots, or chat.

## Production infrastructure sequence

Do not reuse the staging backend or Stripe sandbox objects for production.

1. Approve the production domain and Cloudflare Pages production project.
2. Create a separate production Supabase project in the approved region.
3. Apply committed migrations in order and verify Row Level Security.
4. Configure production authentication URLs, email templates, and account recovery redirects.
5. Deploy the Edge Functions; keep JWT verification disabled only for `stripe-webhook`.
6. Create the live Stripe `FHL Premium` product and $9.99 monthly / $99.99 annual recurring prices.
7. Create a live Stripe webhook destination for the production Supabase webhook URL.
8. Select exactly these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
9. Store live Stripe keys, price IDs, webhook secret, portal configuration, allowed origin, and return URLs only in the production Supabase secret store.
10. Configure the live Customer Portal for payment-method updates, invoice history, and cancellation at period end. Keep plan switching disabled until proration behavior is approved and tested.
11. Configure Cloudflare production build variables with only the production Supabase URL and browser-safe publishable key.
12. Build the public allowlisted artifact and run leakage, security, database, site, and browser checks.
13. Use a designated live smoke-test account for one controlled real monthly purchase, portal check, cancellation, refund, entitlement revocation, and audit review.
14. Obtain explicit owner approval before making the production pricing page publicly discoverable.

## Launch stop conditions

Do not accept real customer payments if any of these conditions exists:

- Stripe business verification is incomplete.
- The production site uses staging Supabase or Stripe sandbox values.
- The site has no approved production domain or customer-support contact.
- A required lifecycle test or audit record is missing.
- Premium content can be downloaded without server authorization.
- Checkout can create overlapping subscriptions.
- A refund, dispute, cancellation, expiration, or payment failure produces the wrong entitlement.
- Required GitHub checks are failing or pending.

## Rollback boundary

If authorization integrity is uncertain, disable checkout and protected delivery first. Prefer an additive forward fix; do not destructively rewrite billing history or learner entitlements. Preserve Stripe events and billing audit records for reconciliation.
