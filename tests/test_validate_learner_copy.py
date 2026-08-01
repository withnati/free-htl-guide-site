from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "validate_learner_copy.py"
SPEC = importlib.util.spec_from_file_location("validate_learner_copy", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LearnerCopyValidationTests(unittest.TestCase):
    def test_repository_learner_copy_has_no_internal_narration(self) -> None:
        self.assertEqual(MODULE.findings(ROOT), [])

    def test_visible_html_finds_banned_phrase(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in MODULE.LEARNER_HTML:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("<!doctype html><html><body><h1>Study</h1></body></html>", encoding="utf-8")
            for relative in MODULE.LEARNER_JS:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("const message = 'Continue studying';", encoding="utf-8")
            target = root / MODULE.LEARNER_HTML[0]
            target.write_text(
                "<!doctype html><html><body><p>The production design checks access.</p></body></html>",
                encoding="utf-8",
            )
            self.assertIn((target, "production design"), MODULE.findings(root))

    def test_script_and_style_content_are_not_treated_as_visible_copy(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in MODULE.LEARNER_HTML:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(
                    "<!doctype html><html><body><h1>Study</h1><script>const x='server-controlled entitlement';</script></body></html>",
                    encoding="utf-8",
                )
            for relative in MODULE.LEARNER_JS:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("const message = 'Continue studying';", encoding="utf-8")
            self.assertEqual(MODULE.findings(root), [])


if __name__ == "__main__":
    unittest.main()
