# Layer 15.2 Subscription UX

## Objective

Create the complete learner-facing subscription experience for one Premium product offered with monthly and annual billing. Payment actions remain inactive until Layer 15.3 connects a live provider.

## Product model

- Free visitor
- Free account
- Premium Monthly
- Premium Annual

Monthly and annual plans provide identical Premium access. Annual billing is a discounted cadence, not a separate feature tier.

## UX surfaces

- Public pricing page
- Monthly/annual billing selector
- Free-versus-Premium feature comparison
- Account subscription page
- Upgrade selection and confirmation states
- Checkout-unavailable state
- Payment pending state
- Subscription active state
- Cancellation scheduled state
- Payment issue and grace-period state
- Expired or revoked state
- Billing portal placeholder
- Upgrade prompts from Premium previews and account pages

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
