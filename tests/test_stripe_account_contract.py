from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PORTAL = (ROOT / 'supabase/functions/create-billing-portal-session/index.ts').read_text(encoding='utf-8')
STATUS = (ROOT / 'supabase/functions/subscription-status/index.ts').read_text(encoding='utf-8')


class StripeAccountContractTests(unittest.TestCase):
    def test_portal_requires_verified_identity_and_server_customer_lookup(self) -> None:
        self.assertIn("authorization.startsWith('Bearer ')", PORTAL)
        self.assertIn('userClient.auth.getUser()', PORTAL)
        self.assertIn(".from('billing_customers')", PORTAL)
        self.assertIn(".eq('user_id', userData.user.id)", PORTAL)
        self.assertNotIn('payload.customer', PORTAL)
        self.assertNotIn('payload.customerId', PORTAL)

    def test_portal_uses_server_return_url_and_optional_configuration(self) -> None:
        self.assertIn('FHL_BILLING_RETURN_URL', PORTAL)
        self.assertIn('STRIPE_PORTAL_CONFIGURATION_ID', PORTAL)
        self.assertIn('stripe.billingPortal.sessions.create', PORTAL)
        self.assertIn('return_url: returnUrl', PORTAL)
        self.assertIn('private, no-store', PORTAL)

    def test_subscription_status_is_derived_from_server_records(self) -> None:
        self.assertIn(".from('billing_subscriptions')", STATUS)
        self.assertIn("admin.rpc('has_effective_entitlement'", STATUS)
        self.assertIn("requested_product_code: 'fhl-premium'", STATUS)
        self.assertNotIn('localStorage', STATUS)
        self.assertNotIn('payload.state', STATUS)
        self.assertNotIn('payload.premiumAccess', STATUS)

    def test_status_exposes_only_learner_safe_fields(self) -> None:
        for field in (
            'state', 'premiumAccess', 'billingCadence', 'currentPeriodEnd',
            'graceUntil', 'cancelAtPeriodEnd', 'canManageBilling',
        ):
            self.assertIn(field, STATUS)
        self.assertNotIn('provider_customer_id', STATUS)
        self.assertNotIn('provider_subscription_id', STATUS)
        self.assertNotIn('metadata:', STATUS)

    def test_cadence_is_resolved_against_server_price_ids(self) -> None:
        self.assertIn('STRIPE_PRICE_PREMIUM_MONTHLY', STATUS)
        self.assertIn('STRIPE_PRICE_PREMIUM_ANNUAL', STATUS)
        self.assertIn("'monthly'", STATUS)
        self.assertIn("'annual'", STATUS)


if __name__ == '__main__':
    unittest.main()
