from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("materialize_fixation_approvals", ROOT / "scripts" / "materialize_fixation_approvals.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

REVIEW_SPEC = importlib.util.spec_from_file_location("question_review", ROOT / "scripts" / "question_review.py")
REVIEW = importlib.util.module_from_spec(REVIEW_SPEC)
assert REVIEW_SPEC and REVIEW_SPEC.loader
REVIEW_SPEC.loader.exec_module(REVIEW)


class FixationApprovalMaterializationTests(unittest.TestCase):
    def setUp(self):
        self.directory = ROOT / "content" / "question-bank" / "review" / "fixation"
        self.questions = MODULE.load_questions(self.directory)
        self.attestation = json.loads((self.directory / "approval-attestation.json").read_text(encoding="utf-8"))
        self.checklists = REVIEW.load_checklists(ROOT / "content" / "question-bank" / "review-checklists.json")

    def test_attestation_exactly_matches_ten_questions(self):
        self.assertEqual(10, len(self.questions))
        self.assertEqual({q["id"] for q in self.questions}, set(self.attestation["question_ids"]))

    def test_twenty_exact_version_approval_events_are_valid(self):
        events = []
        for question in self.questions:
            events.append(MODULE.make_event(question, self.attestation, "scientific"))
            events.append(MODULE.make_event(question, self.attestation, "editorial"))
        self.assertEqual(20, len(events))
        self.assertEqual([], REVIEW.validate_event_log(events, self.checklists))
        for question in self.questions:
            gate = REVIEW.publication_gate(question, events, self.checklists)
            self.assertTrue(gate["publishable"], gate)
            self.assertEqual([], gate["failures"])

    def test_content_edits_invalidate_approval_digest(self):
        question = dict(self.questions[0])
        events = [
            MODULE.make_event(self.questions[0], self.attestation, "scientific"),
            MODULE.make_event(self.questions[0], self.attestation, "editorial"),
        ]
        question["stem"] += " Changed"
        gate = REVIEW.publication_gate(question, events, self.checklists)
        self.assertFalse(gate["publishable"])
        self.assertIn("stale_scientific_review_digest", gate["failures"])
        self.assertIn("stale_editorial_review_digest", gate["failures"])


if __name__ == "__main__":
    unittest.main()
