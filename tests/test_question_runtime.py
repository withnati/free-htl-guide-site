from __future__ import annotations

import json
from pathlib import Path
import subprocess
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "assets" / "question-runtime.js"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


BANK = [
    {
        "id": "fix-sample-0001",
        "status": "approved",
        "access": "sample",
        "certification_scope": "HT_HTL",
        "domain": "fixation",
        "topic": "fixation_mechanisms",
        "difficulty": "foundational",
        "cognitive_level": "recall",
        "stem": "Routine neutral buffered formalin contains approximately which formaldehyde concentration?",
        "options": [
            {"id": "A", "text": "1%"},
            {"id": "B", "text": "4%"},
            {"id": "C", "text": "10%"},
            {"id": "D", "text": "40%"},
        ],
        "correct_option_id": "B",
        "rationale": "Routine 10% neutral buffered formalin contains approximately 4% formaldehyde.",
        "distractor_rationales": {
            "A": "One percent is below the routine concentration.",
            "C": "Ten percent describes the formalin dilution, not final formaldehyde concentration.",
            "D": "Approximately forty percent describes concentrated stock formaldehyde.",
        },
        "learning_objective": "Recognize the concentration of routine neutral buffered formalin.",
        "lesson_refs": ["fixation-v3"],
        "version": 1,
    },
    {
        "id": "proc-premium-0001",
        "status": "approved",
        "access": "premium",
        "certification_scope": "HT_HTL",
        "domain": "processing",
        "topic": "dehydration",
        "difficulty": "applied",
        "cognitive_level": "application",
        "stem": "Which reagent class removes water before clearing during routine tissue processing?",
        "options": [
            {"id": "A", "text": "Alcohol"},
            {"id": "B", "text": "Paraffin"},
            {"id": "C", "text": "Hematoxylin"},
            {"id": "D", "text": "Mounting medium"},
        ],
        "correct_option_id": "A",
        "rationale": "Graded alcohol removes water before a clearing reagent replaces the dehydrant.",
        "distractor_rationales": {
            "B": "Paraffin infiltrates after dehydration and clearing.",
            "C": "Hematoxylin is a stain rather than a processing dehydrant.",
            "D": "Mounting medium is used after staining and coverslipping preparation.",
        },
        "learning_objective": "Identify the purpose of alcohol in tissue processing.",
        "lesson_refs": ["processing-v3"],
        "version": 1,
    },
    {
        "id": "fix-draft-0002",
        "status": "draft",
        "access": "sample",
        "certification_scope": "HT_HTL",
        "domain": "fixation",
        "topic": "fixation_artifacts",
        "difficulty": "applied",
        "cognitive_level": "application",
        "stem": "This draft record must never enter an active learner session.",
        "options": [
            {"id": "A", "text": "A"}, {"id": "B", "text": "B"},
            {"id": "C", "text": "C"}, {"id": "D", "text": "D"}
        ],
        "correct_option_id": "A",
        "rationale": "Draft rationale.",
        "distractor_rationales": {"B": "Draft.", "C": "Draft.", "D": "Draft."},
        "learning_objective": "Draft objective.",
        "lesson_refs": ["fixation-v3"],
        "version": 1,
    },
]


class QuestionRuntimeTests(unittest.TestCase):
    def execute(self, expression: str) -> dict:
        script = textwrap.dedent(
            f"""
            const runtime = require({json.dumps(str(RUNTIME))});
            const bank = {json.dumps(BANK)};
            const value = {expression};
            process.stdout.write(JSON.stringify(value));
            """
        )
        return run_node(script)

    def test_answering_payload_excludes_answer_keys_and_rationales(self) -> None:
        session = self.execute("runtime.createSession(bank, {accessScope:'sample', count:1, seed:'same'})")
        question = session["questions"][0]
        self.assertEqual("fix-sample-0001", question["id"])
        self.assertNotIn("correct_option_id", question)
        self.assertNotIn("rationale", question)
        self.assertNotIn("distractor_rationales", question)
        self.assertNotIn("references", question)

    def test_sample_scope_cannot_receive_premium_or_draft_records(self) -> None:
        session = self.execute("runtime.createSession(bank, {accessScope:'sample', count:1, seed:'scope'})")
        self.assertEqual(["fix-sample-0001"], [item["id"] for item in session["questions"]])

    def test_premium_scope_includes_sample_and_premium_approved_records(self) -> None:
        session = self.execute("runtime.createSession(bank, {accessScope:'premium', count:2, seed:'premium'})")
        self.assertEqual({"fix-sample-0001", "proc-premium-0001"}, {item["id"] for item in session["questions"]})

    def test_same_seed_replays_same_question_and_option_order(self) -> None:
        value = self.execute("({first:runtime.createSession(bank,{accessScope:'premium',count:2,seed:'repeat'}), second:runtime.createSession(bank,{accessScope:'premium',count:2,seed:'repeat'})})")
        self.assertEqual(value["first"], value["second"])

    def test_grading_uses_canonical_record_and_returns_selected_distractor_only(self) -> None:
        result = self.execute("runtime.gradeSubmission(bank,{questionId:'fix-sample-0001',questionVersion:1,selectedOptionId:'C'})")
        self.assertFalse(result["correct"])
        self.assertEqual("B", result["correctOptionId"])
        self.assertIn("formalin dilution", result["selectedDistractorRationale"])
        self.assertNotIn("distractor_rationales", result)

    def test_blueprint_fails_instead_of_silently_weakening_constraints(self) -> None:
        script = textwrap.dedent(
            f"""
            const runtime = require({json.dumps(str(RUNTIME))});
            const bank = {json.dumps(BANK)};
            try {{
              runtime.createSession(bank, {{accessScope:'premium',count:2,seed:'blueprint',blueprint:{{domainTargets:{{fixation:2}}}}}});
              process.stdout.write(JSON.stringify({{error:null}}));
            }} catch (error) {{
              process.stdout.write(JSON.stringify({{error:error.message}}));
            }}
            """
        )
        result = run_node(script)
        self.assertIn("cannot satisfy blueprint target", result["error"])


if __name__ == "__main__":
    unittest.main()
