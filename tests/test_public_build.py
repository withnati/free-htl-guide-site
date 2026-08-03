from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import build_public_site as BUILD  # noqa: E402
import build_public_site_entry  # noqa: F401,E402 - applies learner-facing preview overrides

VALIDATE_SPEC = importlib.util.spec_from_file_location(
    "validate_public_build",
    ROOT / "scripts/validate_public_build.py",
)
VALIDATE = importlib.util.module_from_spec(VALIDATE_SPEC)
assert VALIDATE_SPEC.loader
VALIDATE_SPEC.loader.exec_module(VALIDATE)


class PublicBuildTests(unittest.TestCase):
    def build_preview(self, directory: str) -> Path:
        output = Path(directory) / "dist"
        with patch.dict(
            os.environ,
            {
                "FHL_ENVIRONMENT": "preview",
                "FHL_PUBLIC_SITE_URL": "https://preview.example.test/",
            },
            clear=False,
        ):
            BUILD.build(ROOT, output)
        return output

    def test_allowlisted_public_build_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            self.assertEqual([], VALIDATE.validate(output))

    def test_custom_404_page_is_deployed_and_noindexed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            page = output / "404.html"
            self.assertTrue(page.is_file())
            content = page.read_text(encoding="utf-8")
            self.assertIn('data-page="not-found"', content)
            self.assertIn("We could not find that study page", content)
            self.assertIn('content="noindex,follow"', content)
            self.assertIn(
                'href="https://preview.example.test/404.html"',
                content,
            )

    def test_extensionless_preview_routes_receive_private_headers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            headers = (output / "_headers").read_text(encoding="utf-8")
            self.assertIn(
                "/modules/processing-guide-v3\n  Cache-Control: private, no-store",
                headers,
            )
            self.assertIn(
                "/mock-exam\n  Cache-Control: private, no-store",
                headers,
            )

    def test_premium_routes_are_learner_facing_previews(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            for route in VALIDATE.PREVIEW_ROUTES:
                content = (output / route).read_text(encoding="utf-8")
                self.assertIn('data-page="premium-preview"', content)
                self.assertIn("Premium learning preview", content)
                self.assertIn("Start the free Fixation lesson", content)
                self.assertIn("premium-ui.js", content)
                self.assertNotIn("protected-delivery proof", content.casefold())
                self.assertNotIn("server-controlled entitlement", content.casefold())
                self.assertNotIn("data-correct=", content)
                self.assertNotIn("data-expl=", content)

    def test_question_variant_added_to_dist_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            leaked = output / "data/question-variants-leaked.json"
            leaked.write_text(
                '{"id":"' + "fxv-" + '001","stem":"leaked"}',
                encoding="utf-8",
            )
            issues = VALIDATE.validate(output)
            self.assertTrue(any("question-bank file" in issue or "question ID" in issue for issue in issues))

    def test_private_proof_object_path_added_to_dist_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            leaked = output / "assets/leaked-proof.js"
            leaked.write_text(
                "const path = 'proof/" + "processing-proof-v1.json';",
                encoding="utf-8",
            )
            issues = VALIDATE.validate(output)
            self.assertTrue(any("private proof object path" in issue for issue in issues))

    def test_unapproved_download_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            leaked = output / "assets/premium-answer-key.pdf"
            leaked.write_bytes(b"not a real pdf")
            issues = VALIDATE.validate(output)
            self.assertTrue(any("Unapproved downloadable file" in issue for issue in issues))

    def test_production_build_requires_explicit_environment_values(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dist"
            with patch.dict(
                os.environ,
                {
                    "FHL_ENVIRONMENT": "production",
                    "FHL_PUBLIC_SITE_URL": "",
                    "FHL_SUPABASE_URL": "",
                    "FHL_SUPABASE_PUBLISHABLE_KEY": "",
                },
                clear=False,
            ):
                with self.assertRaises(ValueError):
                    BUILD.build(ROOT, output)


if __name__ == "__main__":
    unittest.main()
