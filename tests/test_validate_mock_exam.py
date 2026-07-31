from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.validate_mock_exam import validate

ROOT = Path(__file__).resolve().parents[1]


class MockExamValidatorTests(unittest.TestCase):
    def fixture(self):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        shutil.copytree(ROOT / "data", root / "data")
        shutil.copy2(ROOT / "mock-exam.html", root / "mock-exam.html")
        for folder in ["assets", "modules"]:
            shutil.copytree(ROOT / folder, root / folder)
        self.addCleanup(temp.cleanup)
        return root

    def edit_json(self, root, relative, callback):
        path = root / relative
        data = json.loads(path.read_text(encoding="utf-8"))
        callback(data)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def messages(self, root):
        return [item.message for item in validate(root)]

    def test_current_repository_contract_is_valid(self):
        self.assertEqual(validate(ROOT), [])

    def test_rejects_wrong_question_total(self):
        root = self.fixture()
        self.edit_json(root, "data/mock-exam-blueprint.json", lambda data: data.update(questionCount=40))
        self.assertTrue(any("questionCount must be 50" in item for item in self.messages(root)))

    def test_rejects_wrong_complete_bank_size(self):
        root = self.fixture()
        self.edit_json(root, "data/mock-exam-blueprint.json", lambda data: data.update(minimumQuestionBankSize=149))
        self.assertTrue(any("minimumQuestionBankSize must be 150" in item for item in self.messages(root)))

    def test_rejects_domain_outside_official_range(self):
        root = self.fixture()
        self.edit_json(root, "data/mock-exam-blueprint.json", lambda data: data["blueprint"][0].update(percent=30))
        self.assertTrue(any("outside its official range" in item for item in self.messages(root)))

    def test_rejects_target_above_available_questions(self):
        root = self.fixture()
        self.edit_json(root, "data/mock-exam-blueprint.json", lambda data: data["blueprint"][1]["moduleTargets"].update({"processing-v3": 25}))
        self.assertTrue(any("exceeds available" in item for item in self.messages(root)))

    def test_rejects_missing_runtime_file(self):
        root = self.fixture()
        (root / "assets/mock-exam.js").unlink()
        self.assertTrue(any("runtime file is missing" in item for item in self.messages(root)))

    def test_rejects_missing_variant_part(self):
        root = self.fixture()
        (root / "data/question-variants-fixation.json").unlink()
        self.assertTrue(any("Missing variant part" in item for item in self.messages(root)))

    def test_rejects_duplicate_variant_id(self):
        root = self.fixture()
        def duplicate(data):
            data["variants"][1]["id"] = data["variants"][0]["id"]
        self.edit_json(root, "data/question-variants-processing.json", duplicate)
        self.assertTrue(any("Duplicate variant id" in item for item in self.messages(root)))

    def test_rejects_answer_fields_in_variant(self):
        root = self.fixture()
        self.edit_json(root, "data/question-variants-he.json", lambda data: data["variants"][0].update(correct="A"))
        self.assertTrue(any("must not define correct" in item for item in self.messages(root)))

    def test_rejects_unknown_source_question(self):
        root = self.fixture()
        self.edit_json(root, "data/question-variants-ihc-ish.json", lambda data: data["variants"][0].update(sourceQuestionId="ihc-ish-99"))
        self.assertTrue(any("references unknown source question" in item for item in self.messages(root)))

    def test_rejects_manifest_count_mismatch(self):
        root = self.fixture()
        self.edit_json(root, "data/question-bank-extension.json", lambda data: data.update(questionCount=79))
        messages = self.messages(root)
        self.assertTrue(any("Variant questionCount must be 80" in item for item in messages))
        self.assertTrue(any("Variant parts contain 80 records" in item for item in messages))


if __name__ == "__main__":
    unittest.main()
