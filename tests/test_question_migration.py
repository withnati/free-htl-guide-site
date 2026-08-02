from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("map_legacy_questions", ROOT / "scripts/map_legacy_questions.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class QuestionMigrationTests(unittest.TestCase):
    def base_record(self):
        return {
            "source_path": "assets/example-bank.js",
            "source_key": "q-1",
            "stem": "Which action best preserves tissue morphology during the initial fixation step?",
            "options": ["Delay fixation", "Use adequate fixative volume", "Freeze all tissue", "Skip grossing"],
            "correct_index": 1,
            "rationale": "Adequate fixative volume supports timely penetration and preservation of tissue morphology.",
            "distractor_rationales": {
                "A": "Delaying fixation increases autolysis and compromises morphology.",
                "C": "Freezing is not the routine substitute for proper chemical fixation in this scenario.",
                "D": "Gross examination and appropriate sectioning support effective fixation rather than replacing it.",
            },
            "domain": "fixation",
            "topic": "fixative_volume",
            "access": "sample",
            "lesson_refs": ["fixation-guide-v3"],
        }

    def test_mapping_is_deterministic_and_draft(self):
        record = self.base_record()
        first, issues = MODULE.map_record(record, now="2026-08-02T05:00:00Z")
        second, _ = MODULE.map_record(record, now="2026-08-02T05:00:00Z")
        self.assertEqual(first["id"], second["id"])
        self.assertEqual("draft", first["status"])
        self.assertEqual([], issues)
        self.assertEqual("B", first["correct_option_id"])

    def test_missing_distractor_rationales_are_explicit_gaps(self):
        record = self.base_record()
        record.pop("distractor_rationales")
        mapped, issues = MODULE.map_record(record, now="2026-08-02T05:00:00Z")
        self.assertIn("missing_distractor_rationale_A", issues)
        self.assertIn("missing_distractor_rationale_C", issues)
        self.assertIn("missing_distractor_rationale_D", issues)
        self.assertIn("Migration gap", mapped["distractor_rationales"]["A"])

    def test_invalid_answer_is_not_silently_accepted(self):
        record = self.base_record()
        record["correct_index"] = 9
        mapped, issues = MODULE.map_record(record, now="2026-08-02T05:00:00Z")
        self.assertIn("missing_or_invalid_correct_index", issues)
        self.assertEqual("A", mapped["correct_option_id"])
        self.assertEqual("pending", mapped["review"]["scientific"]["status"])

    def test_provenance_is_preserved(self):
        mapped, _ = MODULE.map_record(self.base_record(), now="2026-08-02T05:00:00Z")
        self.assertEqual("assets/example-bank.js#q-1", mapped["references"][0]["locator"])
        self.assertEqual(1, mapped["version"])


if __name__ == "__main__":
    unittest.main()
