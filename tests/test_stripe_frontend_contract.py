from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
BILLING = (ROOT / "assets/billing-service.js").read_text(encoding="utf-8")
UI = (ROOT / "assets/subscription-ui.js").read_text(encoding="utf-8")
PRICING = (ROOT / "pricing.html").read_text(encoding="utf-8")
SUBSCRIPTION = (ROOT / "account/subscription.html").read_text(encoding="utf-8")


class StripeFrontendContractTests(unittest.TestCase):
    def test_checkout_sends_only_the_allowlisted_plan(self) -> None:
        self.assertIn("plan !== 'premium_monthly' && plan !== 'premium_annual'", BILLING)
        self.assertIn("create-checkout-session", BILLING)
        self.assertIn("{ body: { plan } }", BILLING)
        for untrusted in ("priceId", "customerId", "userId", "entitlement"):
            self.assertNotIn(untrusted, BILLING)

    def test_identity_comes_from_the_existing_verified_session(self) -> None:
        self.assertIn("auth.getSession()", BILLING)
        self.assertIn("requiresSignIn: true", BILLING)
        self.assertNotIn("localStorage", BILLING)

    def test_checkout_and_portal_urls_are_restricted_to_stripe(self) -> None:
        self.assertIn("checkout.stripe.com", BILLING)
        self.assertIn("billing.stripe.com", BILLING)
        self.assertIn("url.protocol !== 'https:'", BILLING)

    def test_subscription_state_is_loaded_from_the_server_function(self) -> None:
        self.assertIn("subscription-status", BILLING)
        self.assertIn("method: 'GET'", BILLING)
        self.assertIn("getSubscriptionStatus()", UI)
        self.assertNotIn("data-subscription-state", SUBSCRIPTION)

    def test_pages_load_only_browser_safe_billing_dependencies(self) -> None:
        for page in (PRICING, SUBSCRIPTION):
            self.assertIn("supabase-config.js", page)
            self.assertIn("auth-service.js", page)
            self.assertIn("billing-service.js", page)
        self.assertNotIn("STRIPE_SECRET_KEY", PRICING + SUBSCRIPTION + BILLING + UI)
        self.assertNotIn("STRIPE_WEBHOOK_SECRET", PRICING + SUBSCRIPTION + BILLING + UI)

    def test_existing_subscriber_is_sent_to_subscription_management(self) -> None:
        self.assertIn('result.data?.manageSubscription === true', UI)
        self.assertIn("siteUrl('account/subscription.html')", UI)
        self.assertIn('You already have a subscription.', UI)


if __name__ == "__main__":
    unittest.main()
