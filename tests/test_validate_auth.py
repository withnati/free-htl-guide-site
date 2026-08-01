from __future__ import annotations

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("validate_auth", ROOT / "scripts/validate_auth.py")
VALIDATOR = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(VALIDATOR)


class AuthValidatorTests(unittest.TestCase):
    def test_repository_contract_passes(self) -> None:
        self.assertEqual([], VALIDATOR.validate(ROOT))

    def test_secret_key_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "repo"
            shutil.copytree(ROOT, copy)
            config = copy / "assets/supabase-config.js"
            config.write_text(config.read_text(encoding="utf-8") + "\nconst leaked = 'sb_secret_test';\n", encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("prohibited secret" in issue for issue in issues))

    def test_external_next_redirect_protection_is_required(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "repo"
            shutil.copytree(ROOT, copy)
            service = copy / "assets/auth-service.js"
            content = service.read_text(encoding="utf-8").replace("candidate.origin !== rootUrl.origin", "false")
            service.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("candidate.origin" in issue for issue in issues))

    def test_delete_function_rejects_caller_supplied_user_id(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "repo"
            shutil.copytree(ROOT, copy)
            function = copy / "supabase/functions/delete-account/index.ts"
            content = function.read_text(encoding="utf-8").replace(
                "payload.confirm !== 'DELETE MY ACCOUNT'",
                "payload.userId || payload.confirm !== 'DELETE MY ACCOUNT'",
            )
            function.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("caller-supplied user ID" in issue for issue in issues))

    def test_delete_function_must_use_token_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "repo"
            shutil.copytree(ROOT, copy)
            function = copy / "supabase/functions/delete-account/index.ts"
            content = function.read_text(encoding="utf-8").replace(
                "adminClient.auth.admin.deleteUser(userData.user.id)",
                "adminClient.auth.admin.deleteUser('fixed-id')",
            )
            function.write_text(content, encoding="utf-8")
            issues = VALIDATOR.validate(copy)
            self.assertTrue(any("verified bearer token" in issue or "deleteUser" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
