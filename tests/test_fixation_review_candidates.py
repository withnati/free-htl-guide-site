from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

VALIDATOR_SPEC = importlib.util.spec_from_file_location(
    "validate_question_bank", SCRIPTS / "validate_question_bank.py"
)
VALIDATOR = importlib.util.module_from_spec(VALIDATOR_SPEC)
assert VALIDATOR_SPEC.loader
sys.modules[VALIDATOR_SPEC.name] = VALIDATOR
VALIDATOR_SPEC.loader.exec_module(VALIDATOR)

REVIEW_DIR = ROOT / "content/question-bank/review/fixation"
NEUTRAL_PATH = ROOT / "content/question-bank/migration/fixation-v3-neutral.json"
TAXONOMY_PATH = ROOT / "content/question-bank/taxonomy.json"


class FixationReviewCandidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.paths = sorted(REVIEW_DIR.glob("q*.json"))
        cls.questions = [VALIDATOR.load_records(path)[0] for path in cls.paths]
        cls.neutral = json.loads(NEUTRAL_PATH.read_text(encoding="utf-8"))
        cls.taxonomy = VALIDATOR.load_taxonomy(TAXONOMY_PATH)

    def test_exactly_ten_review_candidates_exist(self) -> None:
        self.assertEqual(10, len(self.paths))
        self.assertEqual(10, len(self.questions))

    def test_every_candidate_passes_canonical_validation(self) -> None:
        errors = VALIDATOR.validate_paths(self.paths, taxonomy=self.taxonomy)
        self.assertEqual([], errors)

    def test_shadow_parity_preserves_legacy_educational_content(self) -> None:
        self.assertEqual(len(self.neutral), len(self.questions))
        for source, question in zip(self.neutral, self.questions):
            self.assertEqual(source["stem"], question["stem"])
            self.assertEqual(source["options"], [option["text"] for option in question["options"]])
            self.assertEqual("ABCD"[source["correct_index"]], question["correct_option_id"])
            self.assertEqual(source["rationale"], question["rationale"])
            self.assertEqual(source["domain"], question["domain"])
            self.assertEqual(source["topic"], question["topic"])
            self.assertEqual(source["difficulty"], question["difficulty"])
            self.assertEqual(source["cognitive_level"], question["cognitive_level"])

    def test_all_thirty_distractor_rationales_are_complete(self) -> None:
        total = 0
        for question in self.questions:
            expected = set("ABCD") - {question["correct_option_id"]}
            self.assertEqual(expected, set(question["distractor_rationales"]))
            for rationale in question["distractor_rationales"].values():
                self.assertGreaterEqual(len(rationale.strip()), 30)
                self.assertNotIn("Migration gap", rationale)
                total += 1
        self.assertEqual(30, total)

    def test_public_sample_scope_is_explicit_but_not_yet_published(self) -> None:
        for question in self.questions:
            self.assertEqual("sample", question["access"])
            self.assertEqual("scientific_review", question["status"])
            self.assertEqual("pending", question["review"]["scientific"]["status"])
            self.assertEqual("pending", question["review"]["editorial"]["status"])


if __name__ == "__main__":
    unittest.main()
