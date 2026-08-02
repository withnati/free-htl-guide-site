from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "modules" / "fixation-guide-v3.html"
ADAPTER = ROOT / "assets" / "fixation-canonical-adapter.js"
RUNTIME = ROOT / "assets" / "question-runtime.js"


class FixationShadowActivationBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = MODULE.read_text(encoding="utf-8")
        cls.adapter = ADAPTER.read_text(encoding="utf-8")
        cls.runtime = RUNTIME.read_text(encoding="utf-8")

    def test_learner_page_does_not_load_shadow_runtime_yet(self) -> None:
        self.assertNotIn("question-runtime.js", self.html)
        self.assertNotIn("fixation-canonical-adapter.js", self.html)
        self.assertIn('<script src="../assets/guide.js" defer></script>', self.html)

    def test_embedded_quiz_remains_available_as_rollback(self) -> None:
        self.assertIn('id="fixQuiz"', self.html)
        self.assertEqual(10, self.html.count("<fieldset data-correct="))
        self.assertIn('data-grade="fixQuiz"', self.html)
        self.assertIn('data-retry="fixQuiz"', self.html)

    def test_answering_payload_contract_excludes_protected_feedback(self) -> None:
        answer_payload = self.runtime.split("function answerPayload", 1)[1].split("function createSession", 1)[0]
        self.assertNotIn("correct_option_id", answer_payload)
        self.assertNotIn("rationale", answer_payload)
        self.assertNotIn("distractor_rationales", answer_payload)
        self.assertNotIn("references", answer_payload)
        self.assertNotIn("review", answer_payload)

    def test_progress_projection_does_not_emit_answer_key_or_content(self) -> None:
        projection = self.adapter.split("function toProgressAttempt", 1)[1].split("return Object.freeze", 1)[0]
        for prohibited in (
            "correctOptionId", "rationale", "selectedDistractorRationale", "lessonRefs",
            "stem", "options", "references", "review"
        ):
            self.assertNotIn(prohibited, projection)
        for required in (
            "questionId", "questionVersion", "selectedOptionId", "correct", "domain", "topic"
        ):
            self.assertIn(required, projection)


if __name__ == "__main__":
    unittest.main()
