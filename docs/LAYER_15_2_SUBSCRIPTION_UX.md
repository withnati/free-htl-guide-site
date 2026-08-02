# Layer 15.2 Subscription UX

## Objective

Create the complete learner-facing subscription experience for one Premium product offered with monthly and annual billing. Payment actions remain inactive until Layer 15.3 connects a live provider.

## Product model

- Free visitor
- Free account
- Premium Monthly
- Premium Annual

Monthly and annual plans provide identical Premium access. Annual billing is a discounted cadence, not a separate feature tier.

## Implemented UX surfaces

- Public pricing page
- Monthly/annual billing selector
- Free-versus-Premium feature comparison
- Account subscription page
- Upgrade selection and checkout-unavailable state
- Payment pending page
- Subscription confirmed page
- Checkout canceled page
- Subscription active state
- Cancellation scheduled state
- Payment issue and grace-period state
- Expired or revoked state
- Billing portal placeholder
- Account-settings link to subscription management

## Copy principles

- Explain benefits before billing mechanics.
- Never imply that clicking an upgrade button grants Premium.
- Never claim checkout is available before Layer 15.3.
- Clearly state that monthly and annual plans contain the same features.
- Keep cancellation, renewal, payment issue, and recovery language direct and non-punitive.

## Placeholder behavior

Until live payment integration:

- Upgrade actions open a clear enrollment-not-open message.
- No payment details are collected.
- No fake checkout session is created.
- No local browser state changes the learner's plan.
- Existing server-controlled entitlement behavior remains unchanged.

## Automated coverage

Browser tests cover monthly/annual switching, annual savings copy, safe upgrade behavior, no payment fields, no browser Premium grants, subscription lifecycle states, noindex account pages, and responsive overflow checks. The generated public build includes pricing and all non-indexable account billing states while retaining the premium-content leakage boundary.

## Layer 15.3 handoff

Live integration must replace placeholders with trusted server endpoints for checkout-session creation, billing-portal creation, webhook processing, and entitlement reconciliation. Pricing values remain launch placeholders until approved in the payment provider.
