from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
FUNCTION = ROOT / "supabase/functions/create-checkout-session/index.ts"
PLANS = ROOT / "supabase/functions/_shared/stripe-plans.ts"


class StripeCheckoutContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.function = FUNCTION.read_text(encoding="utf-8")
        cls.plans = PLANS.read_text(encoding="utf-8")

    def test_checkout_requires_authenticated_user_and_controlled_origin(self) -> None:
        self.assertIn("allowedOrigins.has(origin)", self.function)
        self.assertIn("authorization.startsWith('Bearer ')", self.function)
        self.assertIn("userClient.auth.getUser()", self.function)
        self.assertNotIn("payload.userId", self.function)
        self.assertNotIn("payload.user_id", self.function)

    def test_browser_can_submit_only_allowlisted_plan_code(self) -> None:
        self.assertIn("resolveStripePlan(payload.plan)", self.function)
        self.assertIn("premium_monthly", self.plans)
        self.assertIn("premium_annual", self.plans)
        self.assertNotIn("payload.price", self.function)
        self.assertNotIn("payload.priceId", self.function)
        self.assertNotIn("payload.customer", self.function)
        self.assertNotIn("payload.entitlement", self.function)

    def test_price_ids_and_secret_are_server_environment_values(self) -> None:
        self.assertIn("STRIPE_SECRET_KEY", self.function)
        self.assertIn("STRIPE_PRICE_PREMIUM_MONTHLY", self.plans)
        self.assertIn("STRIPE_PRICE_PREMIUM_ANNUAL", self.plans)
        self.assertNotIn("sk_test_", self.function)
        self.assertNotIn("sk_live_", self.function)
        self.assertNotRegex(self.function, r"price_[A-Za-z0-9]{8,}")

    def test_checkout_does_not_grant_or_update_entitlement(self) -> None:
        lowered = self.function.lower()
        self.assertNotIn("from('entitlements')", lowered)
        self.assertNotIn('.from("entitlements")', lowered)
        self.assertNotIn("has_effective_entitlement", lowered)
        self.assertNotIn("grants_premium", lowered)
        self.assertNotIn("premium: true", lowered)

    def test_customer_identity_is_derived_from_verified_session(self) -> None:
        self.assertIn("userData.user.id", self.function)
        self.assertIn("billing_customers", self.function)
        self.assertIn("provider_customer_id", self.function)
        self.assertIn("fhl_user_id", self.function)
        self.assertIn("idempotencyKey", self.function)

    def test_checkout_is_subscription_mode_with_server_redirects(self) -> None:
        self.assertIn("mode: 'subscription'", self.function)
        self.assertIn("FHL_CHECKOUT_SUCCESS_URL", self.function)
        self.assertIn("FHL_CHECKOUT_CANCEL_URL", self.function)
        self.assertIn("success_url: successUrl", self.function)
        self.assertIn("cancel_url: cancelUrl", self.function)
        self.assertIn("Cache-Control", self.function)
        self.assertIn("private, no-store", self.function)


if __name__ == "__main__":
    unittest.main()
