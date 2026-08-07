from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_analytics import Issue, REVIEWED_OPTIONAL_EVENTS, validate_config


class AnalyticsReviewedEventTests(unittest.TestCase):
    def load_config(self) -> dict:
        root = Path(__file__).resolve().parents[1]
        return json.loads((root / "data" / "analytics-config.json").read_text(encoding="utf-8"))

    def validation_messages(self, config: dict) -> list[str]:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "privacy.html").write_text("privacy", encoding="utf-8")
            issues: list[Issue] = []
            validate_config(root, config, issues)
            return [issue.message for issue in issues]

    def test_premium_funnel_events_are_explicitly_reviewed(self) -> None:
        expected = {
            "premium_plan_select",
            "premium_checkout_start",
            "premium_checkout_redirect",
            "premium_checkout_error",
        }
        self.assertEqual(REVIEWED_OPTIONAL_EVENTS, expected)
        messages = self.validation_messages(self.load_config())
        self.assertFalse(any(message.startswith("Unknown analytics events require review:") for message in messages))

    def test_unreviewed_event_still_fails_validation(self) -> None:
        config = self.load_config()
        config["allowedEvents"]["premium_checkout_sensitive_detail"] = ["billing_cadence"]
        messages = self.validation_messages(config)
        self.assertIn(
            "Unknown analytics events require review: premium_checkout_sensitive_detail",
            messages,
        )


if __name__ == "__main__":
    unittest.main()
