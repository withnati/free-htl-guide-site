from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_analytics import validate_analytics


class AnalyticsValidatorTests(unittest.TestCase):
    def make_root(self) -> Path:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / "assets").mkdir()
        (root / "data").mkdir()

        config = {
            "schemaVersion": 1,
            "enabled": False,
            "provider": "google-analytics-4",
            "measurementId": "",
            "consentRequired": True,
            "consentVersion": "2026-07-31",
            "storageKey": "free-htl-analytics-consent",
            "privacyUrl": "privacy.html",
            "retentionMonths": 14,
            "debugParameter": "analytics_debug",
            "eventSchemaVersion": 1,
            "allowedEvents": {
                "page_view": ["page_title", "page_location", "page_referrer"],
                "scroll_depth": ["scroll_percent"],
                "module_open": ["module_path", "link_text"],
                "file_download": ["file_name", "file_extension", "link_text", "link_url"],
                "outbound_click": ["link_domain", "link_text", "link_url"],
                "email_signup_start": ["form_id", "signup_source"],
                "email_signup_success": ["form_id", "signup_source", "transport_type"],
                "email_signup_error": ["form_id", "signup_source", "error_type"],
                "quiz_start": ["quiz_id"],
                "quiz_complete": ["quiz_id", "score", "total_questions", "score_percent", "score_band", "target_met"],
                "quiz_reset": ["quiz_id"],
                "study_task_toggle": ["task_id", "checked"],
                "share": ["share_method", "share_page", "share_url"],
            },
            "prohibitedFields": [
                "email", "email_address", "personal_name", "full_name",
                "personal_note", "note_text", "quiz_answer", "answer_text",
                "question_response", "response_text", "user_id", "client_id",
                "phone", "address", "patient", "employer",
            ],
        }
        (root / "data" / "analytics-config.json").write_text(json.dumps(config), encoding="utf-8")
        (root / "assets" / "analytics-consent.css").write_text(".analytics-banner{}\n", encoding="utf-8")
        (root / "assets" / "guide.js").write_text(
            "const x='analytics.js'; const y='data-free-htl-analytics';\n", encoding="utf-8"
        )
        markers = [
            "analytics-config.json", "consentRequired", "data-free-htl-google-tag",
            "googletagmanager.com/gtag/js", "analytics_storage", "ad_personalization",
            "allow_google_signals", "allow_ad_personalization_signals", "prohibitedFields",
            "safeUrl", "removeAnalyticsCookies", "data-analytics-dialog",
            "data-analytics-banner", "debugEvents",
        ]
        (root / "assets" / "analytics.js").write_text("\n".join(markers), encoding="utf-8")
        self.write_disabled_privacy(root)
        (root / "index.html").write_text(
            '<!doctype html><html><body><script src="assets/guide.js"></script></body></html>',
            encoding="utf-8",
        )
        return root

    def load_config(self, root: Path) -> dict:
        return json.loads((root / "data" / "analytics-config.json").read_text(encoding="utf-8"))

    def save_config(self, root: Path, config: dict) -> None:
        (root / "data" / "analytics-config.json").write_text(json.dumps(config), encoding="utf-8")

    def write_disabled_privacy(self, root: Path) -> None:
        privacy = (
            "<!doctype html><html><body><h1>Privacy choices</h1>"
            "<p>Analytics is currently disabled. If enabled, collection requires explicit consent. "
            "It does not collect email addresses, personal notes, quiz answers, or question responses. "
            "Analytics retention is set to 14 months.</p></body></html>"
        )
        (root / "privacy.html").write_text(privacy, encoding="utf-8")

    def write_enabled_privacy(self, root: Path) -> None:
        privacy = (
            "<!doctype html><html><body><h1>Privacy choices</h1>"
            "<p>Analytics is available only after explicit consent. "
            "It does not collect email addresses, personal notes, quiz answers, or question responses. "
            "Analytics retention is set to 14 months.</p></body></html>"
        )
        (root / "privacy.html").write_text(privacy, encoding="utf-8")

    def test_valid_contract_passes(self) -> None:
        self.assertEqual(validate_analytics(self.make_root()), [])

    def test_valid_enabled_contract_passes(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["enabled"] = True
        config["measurementId"] = "G-BTGBBLRFB3"
        self.save_config(root, config)
        self.write_enabled_privacy(root)
        self.assertEqual(validate_analytics(root), [])

    def test_enabled_analytics_requires_measurement_id(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["enabled"] = True
        self.save_config(root, config)
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("Enabled analytics requires a valid GA4 measurementId", messages)

    def test_disabled_analytics_cannot_retain_measurement_id(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["measurementId"] = "G-ABCDEF12"
        self.save_config(root, config)
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("Disabled analytics must not retain a measurementId", messages)

    def test_missing_consent_requirement_is_reported(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["consentRequired"] = False
        self.save_config(root, config)
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("consentRequired must remain true", messages)

    def test_prohibited_parameter_is_reported(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["allowedEvents"]["quiz_complete"].append("email_address")
        self.save_config(root, config)
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("Prohibited parameter email_address appears in quiz_complete", messages)

    def test_static_google_tag_is_reported(self) -> None:
        root = self.make_root()
        (root / "index.html").write_text(
            '<!doctype html><html><body><script src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEF12"></script></body></html>',
            encoding="utf-8",
        )
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("Third-party analytics tags must not be statically embedded", messages)

    def test_commented_google_tag_is_ignored(self) -> None:
        root = self.make_root()
        (root / "index.html").write_text(
            '<!doctype html><html><body><!-- <script src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEF12"></script> --><script src="assets/guide.js"></script></body></html>',
            encoding="utf-8",
        )
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertNotIn("Third-party analytics tags must not be statically embedded", messages)

    def test_privacy_policy_must_match_disabled_state(self) -> None:
        root = self.make_root()
        (root / "privacy.html").write_text(
            "<html><body>explicit consent email addresses personal notes quiz answers privacy choices 14 months</body></html>",
            encoding="utf-8",
        )
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn("Privacy policy must state: analytics is currently disabled", messages)

    def test_privacy_policy_must_match_enabled_state(self) -> None:
        root = self.make_root()
        config = self.load_config(root)
        config["enabled"] = True
        config["measurementId"] = "G-BTGBBLRFB3"
        self.save_config(root, config)
        messages = [issue.message for issue in validate_analytics(root)]
        self.assertIn(
            "Privacy policy must state: analytics is available only after explicit consent",
            messages,
        )
        self.assertIn(
            "Privacy policy says analytics is disabled while configuration enables it",
            messages,
        )


if __name__ == "__main__":
    unittest.main()
