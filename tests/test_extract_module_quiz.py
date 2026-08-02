from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("extract_module_quiz", ROOT / "scripts/extract_module_quiz.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


HTML = """<!doctype html><html><body>
<section id="quiz"><form>
<fieldset data-correct="B" data-expl="Routine neutral buffered formalin contains approximately four percent formaldehyde.">
<legend>1. Routine neutral buffered formalin contains approximately:</legend>
<label><input type="radio" name="q1" value="A"> 1% formaldehyde</label>
<label><input type="radio" name="q1" value="B"> 4% formaldehyde</label>
<label><input type="radio" name="q1" value="C"> 10% formaldehyde</label>
<label><input type="radio" name="q1" value="D"> 40% formaldehyde</label>
</fieldset>
</form></section>
<section id="references"><p>Not a quiz.</p></section>
</body></html>"""


class ModuleQuizExtractionTests(unittest.TestCase):
    def extract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixation.html"
            path.write_text(HTML, encoding="utf-8")
            return MODULE.extract_module_quiz(
                path,
                module_id="fixation-v3",
                domain="fixation",
                access="sample",
            )

    def test_extracts_stem_options_answer_and_rationale(self):
        records = self.extract()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("Routine neutral buffered formalin contains approximately:", record["stem"])
        self.assertEqual(["1% formaldehyde", "4% formaldehyde", "10% formaldehyde", "40% formaldehyde"], record["options"])
        self.assertEqual(1, record["correct_index"])
        self.assertIn("four percent", record["rationale"])

    def test_preserves_source_identity_and_access(self):
        record = self.extract()[0]
        self.assertTrue(record["source_path"].endswith("fixation.html"))
        self.assertEqual("fixation-v3-1", record["source_key"])
        self.assertEqual("sample", record["access"])
        self.assertEqual(["fixation-v3"], record["lesson_refs"])

    def test_does_not_invent_distractor_rationales(self):
        record = self.extract()[0]
        self.assertNotIn("distractor_rationales", record)
        self.assertEqual("migration_review_required", record["topic"])


if __name__ == "__main__":
    unittest.main()
