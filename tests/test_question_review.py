from __future__ import annotations

from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("question_review", ROOT / "scripts/question_review.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
CHECKLISTS = MODULE.load_checklists(ROOT / "content/question-bank/review-checklists.json")


def question() -> dict:
    return {
        "id": "fix-fixative-selection-0001",
        "status": "draft",
        "access": "sample",
        "certification_scope": "HT_HTL",
        "domain": "fixation",
        "topic": "fixative_selection",
        "difficulty": "applied",
        "cognitive_level": "application",
        "stem": "Which fixative is the best routine choice for balanced morphology and paraffin histology?",
        "options": [
            {"id": "A", "text": "10% neutral buffered formalin"},
            {"id": "B", "text": "Concentrated nitric acid"},
            {"id": "C", "text": "Xylene"},
            {"id": "D", "text": "Paraffin wax"},
        ],
        "correct_option_id": "A",
        "rationale": "Routine 10% neutral buffered formalin provides broadly validated fixation for paraffin histology.",
        "distractor_rationales": {
            "B": "Nitric acid is a strong decalcifier rather than a routine general fixative.",
            "C": "Xylene is a clearing reagent and does not fix tissue proteins.",
            "D": "Paraffin wax is an embedding medium used after fixation and processing.",
        },
        "learning_objective": "Select an appropriate routine fixative for paraffin histology.",
        "lesson_refs": ["fixation-v3"],
        "references": [{"label": "Internal review source", "locator": "Fixation lesson, selecting a fixative"}],
        "version": 1,
    }


def event(q: dict, review_type: str, *, decision: str = "approved", event_id: str | None = None) -> dict:
    checklist = {key: True for key in CHECKLISTS[review_type]}
    return {
        "event_id": event_id or f"rev-{q['id']}-{review_type}-v1",
        "question_id": q["id"],
        "question_version": q["version"],
        "content_digest": MODULE.content_digest(q),
        "review_type": review_type,
        "decision": decision,
        "reviewer": {
            "id": f"reviewer-{review_type}",
            "display_name": "Qualified Reviewer",
            "role_note": "HTL content reviewer" if review_type == "scientific" else "Educational content editor",
        },
        "reviewed_at": "2026-08-02T06:00:00Z" if review_type == "scientific" else "2026-08-02T06:10:00Z",
        "confidence": "high",
        "checklist": checklist,
        "verified_references": ["Fixation lesson, selecting a fixative"] if review_type == "scientific" else [],
        "comments": "Approved for this exact version and content digest.",
        "issue_codes": [],
    }


class QuestionReviewTests(unittest.TestCase):
    def test_digest_is_stable_and_changes_with_material_content(self) -> None:
        first = question()
        second = deepcopy(first)
        self.assertEqual(MODULE.content_digest(first), MODULE.content_digest(second))
        second["stem"] += " Select one answer."
        self.assertNotEqual(MODULE.content_digest(first), MODULE.content_digest(second))

    def test_complete_scientific_and_editorial_reviews_publish(self) -> None:
        q = question()
        result = MODULE.publication_gate(q, [event(q, "scientific"), event(q, "editorial")], CHECKLISTS)
        self.assertTrue(result["publishable"])
        self.assertEqual([], result["failures"])

    def test_content_edit_invalidates_prior_approval(self) -> None:
        q = question()
        events = [event(q, "scientific"), event(q, "editorial")]
        q["options"][0]["text"] = "Buffered formalin"
        result = MODULE.publication_gate(q, events, CHECKLISTS)
        self.assertFalse(result["publishable"])
        self.assertIn("stale_scientific_review_digest", result["failures"])
        self.assertIn("stale_editorial_review_digest", result["failures"])

    def test_approved_review_requires_complete_checklist(self) -> None:
        q = question()
        scientific = event(q, "scientific")
        scientific["checklist"]["single_best_answer"] = False
        errors = MODULE.validate_event(scientific, CHECKLISTS)
        self.assertIn("approved review requires every checklist item to pass", errors)

    def test_scientific_approval_requires_verified_reference(self) -> None:
        q = question()
        scientific = event(q, "scientific")
        scientific["verified_references"] = []
        errors = MODULE.validate_event(scientific, CHECKLISTS)
        self.assertIn("scientific approval requires at least one verified reference locator", errors)

    def test_changes_requested_blocks_publication(self) -> None:
        q = question()
        scientific = event(q, "scientific", decision="changes_requested")
        scientific["checklist"]["single_best_answer"] = False
        scientific["issue_codes"] = ["competing_correct_option"]
        scientific["comments"] = "Option B may also be defensible; revise the scenario."
        result = MODULE.publication_gate(q, [scientific, event(q, "editorial")], CHECKLISTS)
        self.assertIn("scientific_changes_requested", result["failures"])

    def test_superseding_event_must_reference_earlier_matching_event(self) -> None:
        q = question()
        first = event(q, "scientific", event_id="rev-fix-first")
        second = event(q, "editorial", event_id="rev-fix-second")
        second["supersedes_event_id"] = first["event_id"]
        errors = MODULE.validate_event_log([first, second], CHECKLISTS)
        self.assertTrue(any("must match question and review type" in error for error in errors))

    def test_migration_gap_distractors_block_publication(self) -> None:
        q = question()
        q["distractor_rationales"]["B"] = "Migration gap: explanation required."
        events = [event(q, "scientific"), event(q, "editorial")]
        result = MODULE.publication_gate(q, events, CHECKLISTS)
        self.assertIn("distractor_rationales_incomplete", result["failures"])


if __name__ == "__main__":
    unittest.main()
