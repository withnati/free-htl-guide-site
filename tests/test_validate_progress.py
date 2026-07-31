import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("validate_progress", ROOT / "scripts" / "validate_progress.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class ProgressContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.access = json.loads((ROOT / "data" / "content-access.json").read_text())
        cls.schema = json.loads((ROOT / "data" / "progress-schema.json").read_text())

    def test_current_repository_passes(self):
        self.assertEqual(MODULE.validate(ROOT), [])

    def test_only_fixation_is_public(self):
        broken = json.loads(json.dumps(self.access))
        broken["modules"][1]["accessTier"] = "public"
        issues = MODULE.validate_access(broken, ROOT)
        self.assertTrue(any("processing-v3 must be marked premium" in issue for issue in issues))

    def test_client_metadata_cannot_authorize_payment(self):
        broken = json.loads(json.dumps(self.access))
        broken["accountPlan"]["clientMetadataIsNotAuthorization"] = False
        issues = MODULE.validate_access(broken, ROOT)
        self.assertTrue(any("must never be treated as authorization" in issue for issue in issues))

    def test_notes_and_email_are_excluded(self):
        broken = json.loads(json.dumps(self.schema))
        broken["excludedFromAccountSync"].remove("notes")
        broken["excludedFromAccountSync"].remove("emailAddress")
        issues = MODULE.validate_schema(broken)
        self.assertTrue(any("notes must be excluded" in issue for issue in issues))
        self.assertTrue(any("emailAddress must be excluded" in issue for issue in issues))

    def test_targeted_practice_is_syncable_and_resumable(self):
        broken = json.loads(json.dumps(self.schema))
        broken["syncableCollections"].remove("targetedPracticeAttempts")
        broken["activeSessionTypes"].remove("targeted-practice")
        issues = MODULE.validate_schema(broken)
        self.assertTrue(any("targetedPracticeAttempts must be account-syncable" in issue for issue in issues))
        self.assertTrue(any("activeSessionTypes" in issue for issue in issues))

    def test_targeted_practice_is_premium_preview_not_client_authorization(self):
        broken = json.loads(json.dumps(self.access))
        feature = next(item for item in broken["features"] if item["id"] == "targeted-practice")
        feature["accessTier"] = "public"
        feature["previewAvailable"] = False
        issues = MODULE.validate_access(broken, ROOT)
        self.assertTrue(any("targeted-practice must be marked premium" in issue for issue in issues))
        self.assertTrue(any("development preview" in issue for issue in issues))

    def test_dashboard_requires_noindex(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            (root / "my-progress.html").write_text(
                '<link rel="canonical" href="https://withnati.github.io/free-htl-guide-site/my-progress.html">'
                '<script src="assets/progress-service.js"></script><script src="assets/guide.js"></script>'
                '<script src="assets/dashboard.js"></script><div data-module-progress data-domain-progress '
                'data-recent-activity data-export-progress data-reset-progress data-account-status></div>',
                encoding="utf-8",
            )
            (root / "sitemap.xml").write_text("<urlset></urlset>", encoding="utf-8")
            (root / "data" / "site-seo.json").write_text('{"pages":{}}', encoding="utf-8")
            issues = MODULE.validate_dashboard(root)
            self.assertTrue(any("must be noindex" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
