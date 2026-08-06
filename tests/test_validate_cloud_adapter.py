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
            'assets/resilient-cloud-adapter.js',
            'assets/cloud-progress-controller.js',
            'assets/cloud-sync-bootstrap.js',
            'assets/cloud-sync.css',
            'assets/authority.js',
            'assets/dashboard.js',
            'browser-tests/cloud-resilience.spec.cjs',
            'my-progress.html',
            'privacy.html',
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
            page.write_text(
                page.read_text(encoding='utf-8').replace('Use progress already in my account', 'Continue'),
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('Use progress already in my account' in error for error in errors))

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

    def test_rejects_missing_pending_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            resilience = root / 'assets/resilient-cloud-adapter.js'
            resilience.write_text(
                resilience.read_text(encoding='utf-8').replace('free-htl-cloud-pending-v1:', 'removed-pending-key:'),
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('free-htl-cloud-pending-v1:' in error for error in errors))

    def test_rejects_unbounded_token_clock_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            controller = root / 'assets/cloud-progress-controller.js'
            controller.write_text(
                controller.read_text(encoding='utf-8').replace(
                    'const TOKEN_CLOCK_RETRY_DELAYS = [1000, 2000];',
                    'const TOKEN_CLOCK_RETRY_DELAYS = [1000, 2000, 4000];',
                ),
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('TOKEN_CLOCK_RETRY_DELAYS = [1000, 2000]' in error for error in errors))

    def test_rejects_clock_retry_test_on_non_dashboard_route(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            browser_test = root / 'browser-tests/cloud-resilience.spec.cjs'
            browser_test.write_text(
                browser_test.read_text(encoding='utf-8').replace(
                    "page.goto('/my-progress.html')",
                    "page.goto('/modules/fixation-guide-v3.html')",
                ),
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any("page.goto('/my-progress.html')" in error for error in errors))


if __name__ == '__main__':
    unittest.main()
