from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location("migrate_fixation_quiz", SCRIPTS / "migrate_fixation_quiz.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FixationMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = json.loads(
            (ROOT / "content/question-bank/migration/fixation-v3-neutral.json").read_text(encoding="utf-8")
        )
        cls.canonical, cls.report = MODULE.migrate(
            cls.records, now="2026-08-02T05:24:00Z"
        )

    def test_generates_all_ten_fixation_questions(self) -> None:
        self.assertEqual(10, len(self.records))
        self.assertEqual(10, len(self.canonical))
        self.assertEqual(10, self.report["canonical_record_count"])

    def test_preserves_stems_choices_answers_and_rationales(self) -> None:
        for source, question in zip(self.records, self.canonical):
            self.assertEqual(source["stem"], question["stem"])
            self.assertEqual(source["options"], [option["text"] for option in question["options"]])
            self.assertEqual("ABCD"[source["correct_index"]], question["correct_option_id"])
            self.assertEqual(source["rationale"], question["rationale"])

    def test_records_review_gaps_without_approving_questions(self) -> None:
        self.assertEqual(30, self.report["summary"]["missing_distractor_rationales"])
        self.assertEqual(10, self.report["summary"]["access_owner_confirmations"])
        self.assertEqual(0, self.report["summary"]["ready_for_approval"])
        self.assertTrue(all(question["status"] == "draft" for question in self.canonical))
        self.assertTrue(all(question["review"]["scientific"]["status"] == "pending" for question in self.canonical))
        self.assertTrue(all(question["review"]["editorial"]["status"] == "pending" for question in self.canonical))

    def test_uses_controlled_fixation_topics(self) -> None:
        allowed = {
            "fixative_selection", "fixation_mechanisms", "fixation_artifacts",
            "fixation_time_and_volume", "decalcification", "tissue_handling",
        }
        self.assertTrue(all(question["topic"] in allowed for question in self.canonical))


if __name__ == "__main__":
    unittest.main()
