from __future__ import annotations

from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("subscription_state", ROOT / "scripts/subscription_state.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class SubscriptionStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 1, 22, 0, tzinfo=timezone.utc)

    def projection(self, status: str, **kwargs):
        return MODULE.project_premium_access(
            MODULE.SubscriptionSnapshot(status=status, **kwargs), self.now
        )

    def test_active_and_trialing_grant(self) -> None:
        for status in ("active", "trialing"):
            with self.subTest(status=status):
                self.assertTrue(self.projection(status).grants_premium)

    def test_past_due_requires_unexpired_grace(self) -> None:
        self.assertFalse(self.projection("past_due").grants_premium)
        self.assertTrue(self.projection("past_due", grace_until=self.now + timedelta(days=3)).grants_premium)
        self.assertFalse(self.projection("past_due", grace_until=self.now - timedelta(seconds=1)).grants_premium)

    def test_canceled_retains_only_paid_through_access(self) -> None:
        self.assertTrue(self.projection("canceled", current_period_end=self.now + timedelta(days=1)).grants_premium)
        self.assertFalse(self.projection("canceled", current_period_end=self.now).grants_premium)

    def test_terminal_states_deny(self) -> None:
        for status in ("unpaid", "expired", "refunded", "disputed", "revoked"):
            with self.subTest(status=status):
                self.assertFalse(self.projection(status).grants_premium)

    def test_bounded_override_is_explicit(self) -> None:
        result = self.projection(
            "revoked",
            override_grants_access=True,
            override_expires_at=self.now + timedelta(hours=1),
        )
        self.assertTrue(result.grants_premium)
        self.assertEqual("administrative_override", result.reason)

    def test_out_of_order_event_is_rejected(self) -> None:
        newer = self.now
        older = self.now - timedelta(minutes=1)
        self.assertFalse(MODULE.event_is_newer(incoming_created_at=older, stored_created_at=newer))
        self.assertTrue(MODULE.event_is_newer(incoming_created_at=newer, stored_created_at=older))
        self.assertFalse(MODULE.event_is_newer(
            incoming_created_at=newer,
            stored_created_at=older,
            incoming_object_version=4,
            stored_object_version=5,
        ))


if __name__ == "__main__":
    unittest.main()
