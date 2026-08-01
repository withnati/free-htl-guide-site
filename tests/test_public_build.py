from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

BUILD_SPEC = importlib.util.spec_from_file_location(
    "build_public_site",
    ROOT / "scripts/build_public_site.py",
)
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
assert BUILD_SPEC.loader
BUILD_SPEC.loader.exec_module(BUILD)
BUILD.PREVIEW_TEMPLATE = "templates/premium-preview.tpl"

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

    def test_premium_routes_are_generated_previews(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = self.build_preview(directory)
            for route in VALIDATE.PREVIEW_ROUTES:
                content = (output / route).read_text(encoding="utf-8")
                self.assertIn('data-page="premium-preview"', content)
                self.assertIn("Premium learning preview", content)
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
