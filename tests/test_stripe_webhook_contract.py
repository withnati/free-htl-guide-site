from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEBHOOK = ROOT / "supabase/functions/stripe-webhook/index.ts"
HELPERS = ROOT / "supabase/functions/_shared/stripe-subscriptions.ts"
CONFIG = ROOT / "supabase/config.toml"


class StripeWebhookContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.webhook = WEBHOOK.read_text(encoding="utf-8")
        cls.helpers = HELPERS.read_text(encoding="utf-8")
        cls.config = CONFIG.read_text(encoding="utf-8")

    def test_webhook_disables_supabase_jwt_only_for_stripe_endpoint(self) -> None:
        self.assertIn("[functions.stripe-webhook]", self.config)
        self.assertIn("verify_jwt = false", self.config)

    def test_signature_is_verified_against_raw_body_before_ledger_write(self) -> None:
        raw_index = self.webhook.index("const rawBody = await request.text()")
        verify_index = self.webhook.index("constructEventAsync")
        ledger_index = self.webhook.index(".from('billing_events')")
        self.assertLess(raw_index, verify_index)
        self.assertLess(verify_index, ledger_index)
        self.assertIn("stripe-signature", self.webhook)
        self.assertIn("STRIPE_WEBHOOK_SECRET", self.webhook)

    def test_event_ledger_is_idempotent_and_does_not_store_raw_payload(self) -> None:
        self.assertIn("provider_event_id: event.id", self.webhook)
        self.assertIn("payload_digest", self.webhook)
        self.assertIn("ledgerError.code === '23505'", self.webhook)
        self.assertNotIn("raw_payload", self.webhook)
        self.assertNotIn("payload: rawBody", self.webhook)

    def test_subscription_events_are_normalized_and_stale_events_ignored(self) -> None:
        for event_type in (
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        ):
            self.assertIn(event_type, self.webhook)
        self.assertIn("normalizeStripeSubscriptionStatus", self.webhook)
        self.assertIn("ignored_stale", self.webhook)
        self.assertIn("provider_event_created_at", self.webhook)

    def test_billing_projection_updates_server_tables_only(self) -> None:
        for table in (
            "billing_customers",
            "billing_subscriptions",
            "entitlements",
            "billing_audit_log",
        ):
            self.assertIn(f".from('{table}')", self.webhook)
        self.assertNotIn("localStorage", self.webhook)
        self.assertNotIn("checkoutUrl", self.webhook)

    def test_status_normalization_covers_current_stripe_subscription_states(self) -> None:
        for status in (
            "trialing", "active", "past_due", "canceled", "unpaid",
            "incomplete", "incomplete_expired", "paused",
        ):
            self.assertIn(f"case '{status}'", self.helpers)

    def test_payment_grace_is_configuration_driven_and_defaults_to_none(self) -> None:
        self.assertIn("FHL_PAYMENT_GRACE_DAYS", self.helpers)
        self.assertIn("|| '0'", self.helpers)
        self.assertNotIn("days = 7", self.helpers)

    def test_renewal_and_payment_failure_events_reconcile_from_stripe(self) -> None:
        self.assertIn("event.type === 'invoice.paid'", self.webhook)
        self.assertIn("event.type === 'invoice.payment_failed'", self.webhook)
        self.assertIn('invoiceSubscriptionId(invoice)', self.webhook)
        self.assertIn('stripe.subscriptions.retrieve(subscriptionId)', self.webhook)
        self.assertIn("event.type === 'invoice.payment_failed'\n        ? 'past_due'", self.webhook)

    def test_full_refunds_and_disputes_revoke_but_partial_refunds_do_not(self) -> None:
        self.assertIn("event.type === 'charge.refunded'", self.webhook)
        self.assertIn("event.type === 'charge.dispute.created'", self.webhook)
        self.assertIn("reason: 'partial_refund'", self.webhook)
        self.assertIn("terminalState = event.type === 'charge.refunded' ? 'refunded' : 'disputed'", self.webhook)
        self.assertIn("status: 'revoked'", self.webhook)
        self.assertIn('grants_premium: false', self.webhook)

    def test_terminal_payment_events_preserve_ordering_and_auditability(self) -> None:
        self.assertIn("billingSubscription.provider_event_created_at > incomingCreatedAt", self.webhook)
        self.assertIn("action: event.type === 'charge.refunded'", self.webhook)
        self.assertIn("'stripe_full_refund_revoked'", self.webhook)
        self.assertIn("'stripe_dispute_revoked'", self.webhook)


if __name__ == "__main__":
    unittest.main()
