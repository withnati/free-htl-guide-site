import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_targeted_practice", ROOT / "scripts" / "validate_targeted_practice.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class TargetedPracticeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / "data" / "targeted-practice-config.json").read_text())

    def test_current_repository_passes(self):
        self.assertEqual(MODULE.validate(ROOT), [])

    def test_question_counts_are_controlled(self):
        broken = json.loads(json.dumps(self.config))
        broken["questionCounts"] = [5, 10, 20]
        issues = MODULE.validate_config(broken)
        self.assertTrue(any("questionCounts" in issue for issue in issues))

    def test_source_modes_require_weak_missed_and_flagged_practice(self):
        broken = json.loads(json.dumps(self.config))
        broken["sourceModes"] = [{"id": "custom"}]
        issues = MODULE.validate_config(broken)
        self.assertTrue(any("custom, weak, missed, and flagged" in issue for issue in issues))

    def test_feature_cannot_claim_secure_enforcement(self):
        broken = json.loads(json.dumps(self.config))
        broken["premiumEnforcement"] = "client"
        issues = MODULE.validate_config(broken)
        self.assertTrue(any("must not claim secure paywall" in issue for issue in issues))

    def test_page_requires_noindex(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            (root / "targeted-practice.html").write_text(
                '<h1>Targeted practice</h1>'
                '<p>70 authority-reviewed base questions and 80 alternate scenarios</p>'
                '<link rel="canonical" href="https://withnati.github.io/free-htl-guide-site/targeted-practice.html">'
                + ''.join(f'<script src="{src}"></script>' for src in [
                    "assets/mock-exam-bank.js", "assets/mock-exam-bank-dom.js",
                    "assets/mock-exam-bank-modules.js", "assets/mock-exam-bank-load.js",
                    "assets/progress-service.js", "assets/guide.js",
                    "assets/targeted-practice-state.js", "assets/targeted-practice.js",
                ])
                + '<div data-start-practice data-resume-practice data-pool-count data-practice-grid '
                  'data-question-mount data-check-answer data-submit-practice data-practice-domain-results '
                  'data-practice-review data-practice-history-body></div>',
                encoding="utf-8",
            )
            (root / "sitemap.xml").write_text("<urlset></urlset>", encoding="utf-8")
            (root / "data" / "site-seo.json").write_text('{"pages":{}}', encoding="utf-8")
            issues = MODULE.validate_page(root)
            self.assertTrue(any("must remain noindex" in issue for issue in issues))

    def test_page_rejects_claim_that_all_150_records_are_reviewed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            (root / "targeted-practice.html").write_text(
                '<meta name="robots" content="noindex,nofollow">'
                '<h1>Targeted practice</h1>'
                '<p>same reviewed 150-question bank</p>'
                '<link rel="canonical" href="https://withnati.github.io/free-htl-guide-site/targeted-practice.html">'
                + ''.join(f'<script src="{src}"></script>' for src in [
                    "assets/mock-exam-bank.js", "assets/mock-exam-bank-dom.js",
                    "assets/mock-exam-bank-modules.js", "assets/mock-exam-bank-load.js",
                    "assets/progress-service.js", "assets/guide.js",
                    "assets/targeted-practice-state.js", "assets/targeted-practice.js",
                ])
                + '<div data-start-practice data-resume-practice data-pool-count data-practice-grid '
                  'data-question-mount data-check-answer data-submit-practice data-practice-domain-results '
                  'data-practice-review data-practice-history-body></div>',
                encoding="utf-8",
            )
            (root / "sitemap.xml").write_text("<urlset></urlset>", encoding="utf-8")
            (root / "data" / "site-seo.json").write_text('{"pages":{}}', encoding="utf-8")
            issues = MODULE.validate_page(root)
            self.assertTrue(any("must not describe all 150" in issue for issue in issues))

    def test_runtime_rejects_protect_typo(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "data").mkdir()
            (root / ".github" / "workflows").mkdir(parents=True)
            for relative in (
                "assets/targeted-practice.css", "browser-tests/targeted-practice.spec.cjs",
                "docs/LAYER_12_TARGETED_PRACTICE.md",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("", encoding="utf-8")
            (root / "data" / "targeted-practice-config.json").write_text("{}", encoding="utf-8")
            (root / "assets" / "targeted-practice-state.js").write_text(
                "createAttempt hydrateAttempt weakDomains missedQuestionIds flaggedQuestionIds resolvePool "
                "Choose at least one exam domain Choose at least one difficulty level htl:targeted-state",
                encoding="utf-8",
            )
            (root / "assets" / "targeted-practice.js").write_text(
                "recordTargetedPracticeSession recordTargetedPracticeAttempt selectedDomains selectedDifficulties "
                "sourceQuestionId questionResults Study mode protect the lowest domain",
                encoding="utf-8",
            )
            (root / "assets" / "progress-service.js").write_text(
                "targetedPracticeAttempts recordTargetedPracticeSession recordTargetedPracticeAttempt targeted-practice-completed",
                encoding="utf-8",
            )
            (root / "data" / "content-access.json").write_text(
                '{"enforcementMode":"metadata-only","features":[{"id":"targeted-practice",'
                '"path":"targeted-practice.html","accessTier":"premium"}]}',
                encoding="utf-8",
            )
            (root / ".github" / "workflows" / "site-quality.yml").write_text(
                "scripts/validate_targeted_practice.py", encoding="utf-8"
            )
            issues = MODULE.validate_runtime(root)
            self.assertTrue(any("practice, not protect" in issue for issue in issues))

    def test_runtime_forbids_parallel_local_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "data").mkdir()
            (root / ".github" / "workflows").mkdir(parents=True)
            for relative in (
                "assets/targeted-practice.css", "assets/targeted-practice-state.js",
                "assets/targeted-practice.js", "browser-tests/targeted-practice.spec.cjs",
                "docs/LAYER_12_TARGETED_PRACTICE.md",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("", encoding="utf-8")
            (root / "data" / "targeted-practice-config.json").write_text("{}", encoding="utf-8")
            (root / "assets" / "targeted-practice-state.js").write_text(
                "createAttempt hydrateAttempt weakDomains missedQuestionIds flaggedQuestionIds resolvePool "
                "Choose at least one exam domain Choose at least one difficulty level htl:targeted-state",
                encoding="utf-8",
            )
            (root / "assets" / "targeted-practice.js").write_text(
                "recordTargetedPracticeSession recordTargetedPracticeAttempt selectedDomains "
                "selectedDifficulties sourceQuestionId questionResults Study mode localStorage.setItem",
                encoding="utf-8",
            )
            (root / "assets" / "progress-service.js").write_text(
                "targetedPracticeAttempts recordTargetedPracticeSession recordTargetedPracticeAttempt "
                "targeted-practice-completed",
                encoding="utf-8",
            )
            (root / "data" / "content-access.json").write_text(
                '{"enforcementMode":"metadata-only","features":[{"id":"targeted-practice",'
                '"path":"targeted-practice.html","accessTier":"premium"}]}',
                encoding="utf-8",
            )
            (root / ".github" / "workflows" / "site-quality.yml").write_text(
                "scripts/validate_targeted_practice.py", encoding="utf-8"
            )
            issues = MODULE.validate_runtime(root)
            self.assertTrue(any("localStorage.setItem" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
