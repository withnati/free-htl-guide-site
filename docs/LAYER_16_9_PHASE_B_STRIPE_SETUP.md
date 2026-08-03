# Layer 16.9 Phase B — Stripe Sandbox Setup

## Purpose

Connect the existing provider-neutral billing, entitlement, and protected-content architecture to Stripe without allowing browser state, checkout redirects, or user-editable records to grant Premium access.

## Owner-side prerequisite

Create a Stripe account and use a sandbox before any live-mode configuration.

### Initial account setup

1. Create the Stripe account using the legal owner or business identity that will receive subscription revenue.
2. Complete the minimum account profile needed to access the Dashboard and sandbox tools.
3. Keep the integration in a sandbox until the full purchase, renewal, payment-failure, cancellation, expiration, refund, and dispute lifecycle passes.
4. Do not paste Stripe secret keys, webhook secrets, bank information, tax identifiers, or identity documents into GitHub, source files, issues, or chat.

### Sandbox product catalog

Create one product:

- Product name: `FHL Premium`
- Internal product code used by FHL: `fhl-premium`

Create two recurring prices under that product:

- Monthly recurring price
- Annual recurring price

Final amounts are an owner product decision. The repository must consume Stripe Price IDs from server-side environment variables rather than hardcoding them into trusted server logic.

### Customer portal sandbox configuration

Enable at minimum:

- Payment-method updates
- Cancellation at period end
- Invoice history

Do not enable plan switching until the monthly and annual transition policy, proration policy, and test coverage are approved.

## Required server-side secrets

These values must be stored as Supabase project secrets, never committed:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- `STRIPE_PRICE_PREMIUM_ANNUAL`
- `STRIPE_PORTAL_CONFIGURATION_ID` if a non-default portal configuration is used
- `FHL_CHECKOUT_SUCCESS_URL`
- `FHL_CHECKOUT_CANCEL_URL`
- `FHL_BILLING_RETURN_URL`

## Planned Edge Functions

### `create-checkout-session`

Authenticated POST only.

Responsibilities:

- Verify the learner session.
- Accept only an allowlisted plan code (`premium_monthly` or `premium_annual`).
- Resolve the trusted Stripe Price ID from server environment.
- Reuse or create the Stripe Customer associated with the authenticated FHL user.
- Create a Stripe-hosted subscription Checkout Session.
- Include the FHL user ID only as trusted server-generated metadata or client reference.
- Return only the short-lived Checkout URL.
- Never grant entitlement.

### `stripe-webhook`

Public endpoint with Supabase JWT verification disabled; Stripe signature verification is mandatory.

Responsibilities:

- Read the raw request body.
- Verify the `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` before parsing business state.
- Insert the event into the idempotent `billing_events` ledger.
- Treat duplicate event IDs as successful no-ops.
- Normalize Stripe subscription states into the existing billing state model.
- Reject stale or out-of-order state changes.
- Update billing customer and subscription records.
- Project the accepted billing state into the existing `entitlements` table.
- Record the transition in the audit log.
- Return success only after durable processing or a recognized duplicate.

### `create-billing-portal-session`

Authenticated POST only.

Responsibilities:

- Verify the learner session.
- Resolve the learner's trusted Stripe Customer ID from server-only billing records.
- Create a short-lived Stripe Customer Portal Session.
- Return only the portal URL.

## Initial webhook event set

The first controlled implementation should support at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded` or the corresponding refund event selected during implementation
- `charge.dispute.created`

The exact event set must be validated against the final Stripe integration and API version before production activation.

## Security invariants

- Authentication proves identity only.
- Checkout success never grants Premium.
- Only verified Stripe events or documented administrative overrides may change payment-derived entitlement.
- Browser-supplied user IDs, customer IDs, subscription IDs, price IDs, product IDs, statuses, and access flags are untrusted.
- Stripe secret keys and webhook secrets remain server-only.
- Premium content remains absent from unauthorized responses and public deployment output.
- Webhook processing is idempotent and auditable.

## Sandbox completion gate

Do not enable live payments until all of the following pass:

- Successful monthly checkout
- Successful annual checkout
- Existing-customer reuse
- Duplicate webhook delivery
- Out-of-order webhook delivery
- Renewal
- Payment failure and bounded grace behavior
- Payment-method update
- Cancellation at period end
- Reactivation, if supported
- Paid-through cancellation access
- Expiration and Premium lock
- Refund
- Dispute and immediate access policy
- Signed-out and wrong-user denial
- Direct Premium-route denial without entitlement
- Desktop and mobile account experience
- Audit-log and reconciliation verification
