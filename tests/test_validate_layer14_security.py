from __future__ import annotations

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_layer14_security",
    ROOT / "scripts/validate_layer14_security.py",
)
VALIDATOR = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(VALIDATOR)


class Layer14SecurityValidatorTests(unittest.TestCase):
    def copy_repository(self, directory: str) -> Path:
        copy = Path(directory) / "repo"
        shutil.copytree(ROOT, copy)
        return copy

    def test_repository_contract_passes(self) -> None:
        self.assertEqual([], VALIDATOR.validate(ROOT))

    def test_authenticated_entitlement_write_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            migration = copy / VALIDATOR.ENTITLEMENT_MIGRATION
            content = migration.read_text(encoding="utf-8").replace(
                "revoke all on table public.entitlements from authenticated;",
                "grant insert, update on table public.entitlements to authenticated;",
            )
            migration.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("entitlements from authenticated" in issue for issue in issues))

    def test_caller_controlled_storage_path_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            function = copy / VALIDATOR.PREMIUM_FUNCTION
            content = function.read_text(encoding="utf-8").replace(
                ".download(protectedContent.objectPath)",
                ".download(payload.objectPath)",
            )
            function.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("object path" in issue.lower() for issue in issues))

    def test_wildcard_cors_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            function = copy / VALIDATOR.PREMIUM_FUNCTION
            content = function.read_text(encoding="utf-8").replace(
                "headers.set('Access-Control-Allow-Origin', origin)",
                "headers.set('Access-Control-Allow-Origin', '*')",
            )
            function.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("wildcard" in issue.lower() or "prohibited token" in issue.lower() for issue in issues))

    def test_public_proof_payload_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            payload = copy / "data/processing-proof-v1.json"
            payload.write_text('{"contentId":"processing-proof-v1"}', encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("Protected proof payload" in issue for issue in issues))

    def test_public_study_plan_payload_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            payload = copy / "data/study-plan-v1.json"
            payload.write_text('{"contentId":"study-plan-v1"}', encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("Protected proof payload" in issue for issue in issues))

    def test_browser_workflow_cannot_fall_back_to_npm_install(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            workflow = copy / VALIDATOR.BROWSER_WORKFLOW
            content = workflow.read_text(encoding="utf-8").replace(
                "npm ci --ignore-scripts --no-audit --no-fund",
                "npm install --ignore-scripts --no-audit --no-fund",
            )
            workflow.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("npm ci" in issue or "npm install" in issue for issue in issues))

    def test_secret_material_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = self.copy_repository(directory)
            leaked = copy / "docs/leaked-secret.txt"
            fake_prefix = "github_" + "pat_"
            leaked.write_text(
                f"Never commit {fake_prefix}EXAMPLE12345678901234567890",
                encoding="utf-8",
            )
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("GitHub personal access token" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
