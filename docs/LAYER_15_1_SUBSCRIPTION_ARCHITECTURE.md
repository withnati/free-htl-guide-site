# Layer 15.1 Subscription Architecture

## Objective

Add a provider-neutral, server-controlled subscription foundation that can later be connected to Stripe without allowing browser state, checkout return URLs, profile metadata, or user-editable records to grant Premium access.

## Preserved boundaries

- Authentication proves identity only.
- Entitlements remain the only source of Premium access.
- Payment-provider events and server reconciliation are authoritative.
- Checkout success pages never grant access.
- Provider secrets, service-role credentials, and webhook secrets remain server-only.
- Premium learning content is never shipped to unauthorized browsers.

## Lifecycle model

Provider subscription states are normalized into the following internal states:

- `trialing`
- `active`
- `grace`
- `past_due`
- `canceled`
- `unpaid`
- `expired`
- `refunded`
- `disputed`
- `revoked`

Access projection:

- `trialing`, `active`, and an explicitly bounded `grace` state may grant Premium.
- `past_due` may grant only when a server-controlled grace deadline is still active.
- `canceled` may retain access through the paid-through timestamp.
- `unpaid`, `expired`, `refunded`, `disputed`, and `revoked` deny Premium unless an administrator records a documented override.

## Core records

- Billing customers: one internal user to one provider customer per provider.
- Billing subscriptions: provider references, normalized status, product/price identifiers, billing period, cancel state, and event ordering markers.
- Billing events: immutable provider-event ledger with unique provider event IDs, signature verification status, processing outcome, attempt count, and timestamps.
- Subscription audit log: immutable record of state changes, reconciliation, administrative corrections, and entitlement projections.
- Administrative overrides: time-bounded, reason-required corrections that never edit provider history.

## Event-processing rules

1. Verify the provider signature before parsing or writing business state.
2. Insert the event ID into the immutable ledger before processing.
3. Treat duplicate event IDs as successful no-ops.
4. Lock the affected subscription row during projection.
5. Compare provider event creation time and provider object version markers before applying a change.
6. Ignore stale out-of-order events while retaining them in the ledger.
7. Recompute entitlement from normalized subscription state after every accepted transition.
8. Record the previous and resulting state in the audit log.
9. Retry transient failures without duplicating state transitions.
10. Provide reconciliation that reads current provider state and repairs drift through the same projection path.

## Layer 15.1 exclusions

- Live Stripe products and prices
- Checkout sessions
- Billing portal sessions
- Real webhook secrets
- Customer charges
- Production Supabase or custom-domain setup
- Browser payment SDKs

## Planned implementation files

- SQL migration for billing and audit records
- Pure subscription-state projection module
- Idempotent event-processing contract
- Reconciliation and administrative-recovery contract
- Database and unit tests
- Security and deployment documentation
