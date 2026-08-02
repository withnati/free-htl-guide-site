from __future__ import annotations

from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_question_bank", ROOT / "scripts" / "validate_question_bank.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def valid_question() -> dict:
    return {
        "id": "fix-fixative-selection-0001",
        "status": "draft",
        "access": "premium",
        "certification_scope": "HT_HTL",
        "domain": "fixation",
        "topic": "fixative_selection",
        "difficulty": "applied",
        "cognitive_level": "application",
        "stem": "A laboratory scenario requires the learner to select the most appropriate next action.",
        "options": [
            {"id": "A", "text": "Option one"},
            {"id": "B", "text": "Option two"},
            {"id": "C", "text": "Option three"},
            {"id": "D", "text": "Option four"},
        ],
        "correct_option_id": "B",
        "rationale": "This draft rationale is long enough for structural validation and is not approved educational content.",
        "distractor_rationales": {
            "A": "This draft distractor explanation is incomplete.",
            "C": "This draft distractor explanation is incomplete.",
            "D": "This draft distractor explanation is incomplete.",
        },
        "learning_objective": "Apply a defined histotechnology decision rule.",
        "lesson_refs": ["fixation-guide-v3"],
        "references": [{"label": "Internal drafting source", "locator": "pending review"}],
        "review": {
            "scientific": {"status": "pending", "reviewer": None, "reviewed_at": None, "notes": ""},
            "editorial": {"status": "pending", "reviewer": None, "reviewed_at": None, "notes": ""},
        },
        "version": 1,
        "created_at": "2026-08-02T02:00:00Z",
        "updated_at": "2026-08-02T02:00:00Z",
    }


class QuestionBankValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.taxonomy = MODULE.load_taxonomy(ROOT / "content" / "question-bank" / "taxonomy.json")

    def test_valid_draft_record_passes(self) -> None:
        self.assertEqual([], MODULE.validate_record(valid_question(), Path("bank.json"), 0, self.taxonomy))

    def test_approved_record_requires_both_completed_reviews(self) -> None:
        question = valid_question()
        question["status"] = "approved"
        errors = MODULE.validate_record(question, Path("bank.json"), 0, self.taxonomy)
        self.assertTrue(any("scientific review" in error for error in errors))
        self.assertTrue(any("editorial review" in error for error in errors))

    def test_correct_answer_cannot_have_distractor_rationale(self) -> None:
        question = valid_question()
        question["distractor_rationales"]["B"] = "The correct answer must not be treated as a distractor."
        errors = MODULE.validate_record(question, Path("bank.json"), 0, self.taxonomy)
        self.assertTrue(any("three incorrect options" in error for error in errors))

    def test_taxonomy_rejects_topic_in_wrong_domain(self) -> None:
        question = valid_question()
        question["topic"] = "water_bath"
        errors = MODULE.validate_record(question, Path("bank.json"), 0, self.taxonomy)
        self.assertTrue(any("not allowed for domain" in error for error in errors))

    def test_public_root_rejects_premium_records(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            public_root = Path(temp_dir) / "public"
            public_root.mkdir()
            bank = public_root / "questions.json"
            bank.write_text(json.dumps([valid_question()]), encoding="utf-8")
            errors = MODULE.validate_paths([bank], public_root, self.taxonomy)
        self.assertTrue(any("Premium question present" in error for error in errors))

    def test_duplicate_ids_are_rejected_across_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            first = Path(temp_dir) / "first.json"
            second = Path(temp_dir) / "second.json"
            first.write_text(json.dumps([valid_question()]), encoding="utf-8")
            second.write_text(json.dumps([deepcopy(valid_question())]), encoding="utf-8")
            errors = MODULE.validate_paths([first, second], taxonomy=self.taxonomy)
        self.assertTrue(any("duplicate id" in error for error in errors))

    def test_timestamp_order_is_enforced(self) -> None:
        question = valid_question()
        question["updated_at"] = "2026-08-01T02:00:00Z"
        errors = MODULE.validate_record(question, Path("bank.json"), 0, self.taxonomy)
        self.assertTrue(any("cannot precede" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
