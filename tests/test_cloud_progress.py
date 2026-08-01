from __future__ import annotations

"""Regression tests for the unchanged Layer 13/14 cloud-progress database contract.

Layer 14.5 changes learner-facing copy only. Keeping this suite in the branch also
forces Database Quality to re-run and confirm that the existing schema and RLS
boundaries remain intact while the copy layer is reviewed.
"""

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "validate_cloud_progress.py"
SPEC = importlib.util.spec_from_file_location("validate_cloud_progress", MODULE_PATH)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class CloudProgressValidatorTests(unittest.TestCase):
    def test_repository_contract_passes(self) -> None:
        self.assertEqual([], VALIDATOR.validate(ROOT))

    def test_missing_rls_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = self._copy_contract_files(Path(directory))
            migration = root / VALIDATOR.MIGRATION
            content = migration.read_text(encoding="utf-8")
            content = content.replace(
                "alter table public.module_progress enable row level security;",
                "-- removed for negative test",
                1,
            )
            migration.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(root)
            self.assertTrue(any("module_progress must enable Row Level Security" in issue for issue in issues))

    def test_prohibited_content_column_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = self._copy_contract_files(Path(directory))
            migration = root / VALIDATOR.MIGRATION
            content = migration.read_text(encoding="utf-8")
            content = content.replace("display_name text,", "display_name text,\n  question_text text,", 1)
            migration.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(root)
            self.assertTrue(any("prohibited cloud-progress column question_text" in issue for issue in issues))

    @staticmethod
    def _copy_contract_files(root: Path) -> Path:
        paths = [
            VALIDATOR.MIGRATION,
            VALIDATOR.ARCHITECTURE,
            VALIDATOR.SUPABASE_README,
            ".gitignore",
            ".github/workflows/site-quality.yml",
        ]
        for relative in paths:
            source = ROOT / relative
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        return root


if __name__ == "__main__":
    unittest.main()
