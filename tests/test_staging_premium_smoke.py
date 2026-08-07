from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class StagingPremiumSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = (ROOT / ".github/workflows/staging-premium-smoke.yml").read_text(encoding="utf-8")
        self.config = (ROOT / "playwright.staging-premium.config.cjs").read_text(encoding="utf-8")
        self.spec = (ROOT / "browser-tests/staging-premium.spec.cjs").read_text(encoding="utf-8")

    def test_workflow_is_manual_staging_only_and_uses_encrypted_secrets(self) -> None:
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertNotIn("pull_request:", self.workflow)
        self.assertNotIn("push:", self.workflow)
        self.assertIn("environment: staging", self.workflow)
        self.assertIn("secrets.FHL_STAGING_PREMIUM_EMAIL", self.workflow)
        self.assertIn("secrets.FHL_STAGING_PREMIUM_PASSWORD", self.workflow)

    def test_sensitive_browser_artifacts_are_disabled(self) -> None:
        self.assertIn("trace: 'off'", self.config)
        self.assertIn("video: 'off'", self.config)
        self.assertNotIn("upload-artifact", self.workflow)

    def test_smoke_check_uses_clean_sessions_and_restores_task_state(self) -> None:
        self.assertIn("await browser.newContext()", self.spec)
        self.assertIn("toHaveCount(35)", self.spec)
        self.assertIn("setChecked(originalChecked)", self.spec)
        self.assertIn("data-cloud-progress", self.spec)


if __name__ == "__main__":
    unittest.main()
