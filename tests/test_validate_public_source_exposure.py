import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'validate_public_source_exposure',
    ROOT / 'scripts/validate_public_source_exposure.py'
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class PublicSourceExposureTests(unittest.TestCase):
    def copy_contract_files(self, destination: Path):
        (destination / 'data').mkdir(parents=True, exist_ok=True)
        (destination / 'modules').mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / 'data/content-access.json', destination / 'data/content-access.json')
        shutil.copy2(ROOT / 'modules/fixation-guide-v3.html', destination / 'modules/fixation-guide-v3.html')
        for relative in MODULE.LEGACY_PREMIUM_BLOBS:
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)

    def test_repository_contract_passes(self):
        self.assertEqual([], MODULE.validate(ROOT))

    def test_incremental_edit_to_exposed_premium_lesson_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            path = root / 'modules/processing-guide-v3.html'
            path.write_text(path.read_text(encoding='utf-8') + '\n<!-- proprietary edit -->\n', encoding='utf-8')
            errors = MODULE.validate(root)
            self.assertTrue(any('processing-guide-v3.html changed from its frozen legacy Premium blob' in error for error in errors))

    def test_preview_safe_replacement_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            path = root / 'modules/processing-guide-v3.html'
            path.write_text(
                '<!doctype html><html><body data-page="premium-preview">'
                '<a href="../pricing.html" data-premium-upgrade-action>Compare Premium plans</a>'
                '</body></html>',
                encoding='utf-8'
            )
            self.assertEqual([], MODULE.validate(root))

    def test_new_premium_full_lesson_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            metadata_path = root / 'data/content-access.json'
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            metadata['modules'].append({
                'id': 'new-premium',
                'title': 'New Premium Lesson',
                'path': 'modules/new-premium.html',
                'domain': 'Example',
                'accessTier': 'premium',
                'order': 8
            })
            metadata_path.write_text(json.dumps(metadata), encoding='utf-8')
            (root / 'modules/new-premium.html').write_text(
                '<body><article class="content"><section id="quiz">'
                '<fieldset data-correct="A" data-expl="answer">Question</fieldset>'
                '</section></article></body>',
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('New Premium module source is not preview-safe' in error for error in errors))
            self.assertTrue(any('Answer-key metadata is exposed' in error for error in errors))

    def test_new_premium_preview_shell_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            metadata_path = root / 'data/content-access.json'
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            metadata['modules'].append({
                'id': 'new-premium',
                'title': 'New Premium Lesson',
                'path': 'modules/new-premium.html',
                'domain': 'Example',
                'accessTier': 'premium',
                'order': 8
            })
            metadata_path.write_text(json.dumps(metadata), encoding='utf-8')
            (root / 'modules/new-premium.html').write_text(
                '<!doctype html><html><body data-page="premium-preview">'
                '<a href="../pricing.html" data-premium-upgrade-action>Compare Premium plans</a>'
                '</body></html>',
                encoding='utf-8'
            )
            self.assertEqual([], MODULE.validate(root))

    def test_unclassified_answer_key_page_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_contract_files(root)
            (root / 'modules/accidental-premium.html').write_text(
                '<fieldset data-correct="B" data-expl="private explanation">Question</fieldset>',
                encoding='utf-8'
            )
            errors = MODULE.validate(root)
            self.assertTrue(any('Answer-key metadata is exposed' in error for error in errors))


if __name__ == '__main__':
    unittest.main()
