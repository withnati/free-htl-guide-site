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
        for relative in ["data/mock-exam-blueprint.json", "mock-exam.html"]:
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        for folder in ["assets", "modules"]:
            shutil.copytree(ROOT / folder, root / folder)
        self.addCleanup(temp.cleanup)
        return root

    def edit_blueprint(self, root, callback):
        path = root / "data/mock-exam-blueprint.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        callback(data)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def messages(self, root):
        return [item.message for item in validate(root)]

    def test_current_repository_contract_is_valid(self):
        self.assertEqual(validate(ROOT), [])

    def test_rejects_wrong_question_total(self):
        root = self.fixture()
        self.edit_blueprint(root, lambda data: data.update(questionCount=40))
        self.assertTrue(any("questionCount must be 50" in item for item in self.messages(root)))

    def test_rejects_domain_outside_official_range(self):
        root = self.fixture()
        self.edit_blueprint(root, lambda data: data["blueprint"][0].update(percent=30))
        self.assertTrue(any("outside its official range" in item for item in self.messages(root)))

    def test_rejects_target_above_available_questions(self):
        root = self.fixture()
        self.edit_blueprint(root, lambda data: data["blueprint"][1]["moduleTargets"].update({"processing-v3": 11}))
        self.assertTrue(any("exceeds available" in item for item in self.messages(root)))

    def test_rejects_missing_runtime_file(self):
        root = self.fixture()
        (root / "assets/mock-exam.js").unlink()
        self.assertTrue(any("runtime file is missing" in item for item in self.messages(root)))


if __name__ == "__main__":
    unittest.main()
