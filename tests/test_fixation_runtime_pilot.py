from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "validate_fixation_runtime_pilot", SCRIPTS / "validate_fixation_runtime_pilot.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FixationRuntimePilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.legacy = MODULE.extract_module_quiz(
            ROOT / "modules/fixation-guide-v3.html",
            module_id="fixation-v3",
            domain="fixation",
            access="sample",
        )
        cls.pilot = json.loads(
            (ROOT / "content/question-bank/migration/fixation-v3-neutral.json").read_text(encoding="utf-8")
        )

    def test_shadow_source_has_exact_legacy_parity(self) -> None:
        self.assertEqual([], MODULE.compare(self.legacy, self.pilot))

    def test_parity_detects_answer_key_change(self) -> None:
        changed = json.loads(json.dumps(self.pilot))
        changed[0]["correct_index"] = 0
        errors = MODULE.compare(self.legacy, changed)
        self.assertIn("question 1 correct_index differs", errors)

    def test_parity_detects_stem_and_option_changes(self) -> None:
        changed = json.loads(json.dumps(self.pilot))
        changed[1]["stem"] += " Changed"
        changed[1]["options"][0] = "Changed option"
        errors = MODULE.compare(self.legacy, changed)
        self.assertIn("question 2 stem differs", errors)
        self.assertIn("question 2 options differs", errors)

    @staticmethod
    def sample_bank() -> list[dict]:
        return [
            {
                "id": "fix-approved-1", "version": 1, "status": "approved", "access": "sample",
                "certification_scope": "HT_HTL", "domain": "fixation", "topic": "fixation_mechanisms",
                "difficulty": "foundational", "cognitive_level": "recall", "stem": "Approved sample question stem.",
                "options": [{"id": key, "text": key} for key in "ABCD"], "correct_option_id": "A",
                "rationale": "Approved rationale long enough for this isolated adapter test.",
                "distractor_rationales": {"B": "Wrong B explanation.", "C": "Wrong C explanation.", "D": "Wrong D explanation."},
                "lesson_refs": ["fixation-v3"],
            },
            {
                "id": "fix-approved-2", "version": 3, "status": "approved", "access": "sample",
                "certification_scope": "HT_HTL", "domain": "fixation", "topic": "fixation_artifacts",
                "difficulty": "applied", "cognitive_level": "application", "stem": "Second approved sample question.",
                "options": [{"id": key, "text": key} for key in "ABCD"], "correct_option_id": "C",
                "rationale": "Second approved rationale long enough for this isolated adapter test.",
                "distractor_rationales": {"A": "Wrong A explanation.", "B": "Wrong B explanation.", "D": "Wrong D explanation."},
                "lesson_refs": ["fixation-v3"],
            },
            {
                "id": "fix-draft-3", "version": 1, "status": "draft", "access": "sample",
                "certification_scope": "HT_HTL", "domain": "fixation", "topic": "fixation_artifacts",
                "difficulty": "applied", "cognitive_level": "application", "stem": "Draft question must not load.",
                "options": [{"id": key, "text": key} for key in "ABCD"], "correct_option_id": "A",
                "rationale": "Draft rationale.", "distractor_rationales": {"B": "B", "C": "C", "D": "D"},
                "lesson_refs": ["fixation-v3"],
            },
        ]

    def run_node(self, body: str) -> dict:
        script = textwrap.dedent(
            f"""
            global.FreeHTLQuestionRuntime = require({json.dumps(str(ROOT / 'assets/question-runtime.js'))});
            const adapter = require({json.dumps(str(ROOT / 'assets/fixation-canonical-adapter.js'))});
            const bank = {json.dumps(self.sample_bank())};
            {body}
            """
        )
        result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_dormant_adapter_uses_approved_sample_records_only(self) -> None:
        session = self.run_node(
            "const session = adapter.createPilotSession(bank, 'pilot'); process.stdout.write(JSON.stringify(session));"
        )
        self.assertEqual(2, session["count"])
        self.assertEqual({"fix-approved-1", "fix-approved-2"}, {item["id"] for item in session["questions"]})
        for question in session["questions"]:
            self.assertNotIn("correct_option_id", question)
            self.assertNotIn("rationale", question)
            self.assertNotIn("distractor_rationales", question)

    def test_progress_projection_contains_only_allowlisted_result_metadata(self) -> None:
        attempt = self.run_node(
            """
            const results = [
              {...FreeHTLQuestionRuntime.gradeSubmission(bank, {questionId: 'fix-approved-1', questionVersion: 1, selectedOptionId: 'A'}), omitted: false},
              {...FreeHTLQuestionRuntime.gradeSubmission(bank, {questionId: 'fix-approved-2', questionVersion: 3, selectedOptionId: 'B'}), omitted: false}
            ];
            process.stdout.write(JSON.stringify(adapter.toProgressAttempt(results, {attemptId: 'attempt-1', completedAt: '2026-08-02T21:45:00Z'})));
            """
        )
        self.assertEqual(1, attempt["score"])
        self.assertEqual(2, attempt["total"])
        self.assertEqual(50, attempt["percent"])
        self.assertFalse(attempt["targetMet"])
        self.assertEqual("attempt-1", attempt["attemptId"])
        self.assertEqual(2, len(attempt["questionResults"]))
        allowed = {
            "questionId", "questionVersion", "moduleId", "domain", "topic", "difficulty",
            "selectedOptionId", "correct", "omitted", "flagged"
        }
        for item in attempt["questionResults"]:
            self.assertEqual(allowed, set(item))
            self.assertNotIn("correctOptionId", item)
            self.assertNotIn("rationale", item)
            self.assertNotIn("selectedDistractorRationale", item)
            self.assertNotIn("lessonRefs", item)

    def test_progress_projection_preserves_omitted_question_identity(self) -> None:
        attempt = self.run_node(
            """
            const results = [{
              questionId: 'fix-approved-2', questionVersion: 3, selectedOptionId: null,
              correct: false, omitted: true, domain: 'fixation', topic: 'fixation_artifacts', difficulty: 'applied'
            }];
            process.stdout.write(JSON.stringify(adapter.toProgressAttempt(results)));
            """
        )
        result = attempt["questionResults"][0]
        self.assertTrue(result["omitted"])
        self.assertIsNone(result["selectedOptionId"])
        self.assertEqual(3, result["questionVersion"])
        self.assertEqual("fixation_artifacts", result["topic"])


if __name__ == "__main__":
    unittest.main()
