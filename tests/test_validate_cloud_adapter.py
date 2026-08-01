import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('validate_cloud_adapter', ROOT / 'scripts/validate_cloud_adapter.py')
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class CloudAdapterValidationTests(unittest.TestCase):
    def test_repository_contract(self):
        self.assertEqual([], MODULE.validate(ROOT))

    def copy_contract_files(self, destination: Path):
        for relative in (
            'assets/cloud-progress-adapter.js',
            'assets/cloud-progress-controller.js',
            'assets/cloud-sync-bootstrap.js',
            'assets/authority.js',
            'assets/dashboard.js',
            'my-progress.html',
        ):
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)

    def test_rejects_secret_key_tokens(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            adapter = root / 'assets/cloud-progress-adapter.js'
            adapter.write_text(adapter.read_text(encoding='utf-8') + '\nconst leaked = "sb_secret_example";\n', encoding='utf-8')
            errors = MODULE.validate(root)
            self.assertTrue(any('Forbidden cloud-progress token' in error for error in errors))

    def test_rejects_missing_explicit_import_choice(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            page = root / 'my-progress.html'
            page.write_text(page.read_text(encoding='utf-8').replace('Use account progress only', 'Continue'), encoding='utf-8')
            errors = MODULE.validate(root)
            self.assertTrue(any('Use account progress only' in error for error in errors))

    def test_rejects_missing_global_account_match(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            bootstrap = root / 'assets/cloud-sync-bootstrap.js'
            bootstrap.write_text(
                bootstrap.read_text(encoding='utf-8').replace('session.user.id !== decision.userId', 'false'),
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('session.user.id !== decision.userId' in error for error in errors))


if __name__ == '__main__':
    unittest.main()
