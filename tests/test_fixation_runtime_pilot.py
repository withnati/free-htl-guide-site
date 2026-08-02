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

    def test_dormant_adapter_uses_approved_sample_records_only(self) -> None:
        bank = [
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
                "id": "fix-draft-2", "version": 1, "status": "draft", "access": "sample",
                "certification_scope": "HT_HTL", "domain": "fixation", "topic": "fixation_artifacts",
                "difficulty": "applied", "cognitive_level": "application", "stem": "Draft question must not load.",
                "options": [{"id": key, "text": key} for key in "ABCD"], "correct_option_id": "A",
                "rationale": "Draft rationale.", "distractor_rationales": {"B": "B", "C": "C", "D": "D"},
                "lesson_refs": ["fixation-v3"],
            },
        ]
        script = textwrap.dedent(
            f"""
            global.FreeHTLQuestionRuntime = require({json.dumps(str(ROOT / 'assets/question-runtime.js'))});
            const adapter = require({json.dumps(str(ROOT / 'assets/fixation-canonical-adapter.js'))});
            const session = adapter.createPilotSession({json.dumps(bank)}, 'pilot');
            process.stdout.write(JSON.stringify(session));
            """
        )
        result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True)
        session = json.loads(result.stdout)
        self.assertEqual(1, session["count"])
        self.assertEqual("fix-approved-1", session["questions"][0]["id"])
        self.assertNotIn("correct_option_id", session["questions"][0])


if __name__ == "__main__":
    unittest.main()
