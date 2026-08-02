from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

BUILD_SPEC = importlib.util.spec_from_file_location(
    "build_subscription_site_entry", SCRIPTS / "build_subscription_site_entry.py"
)
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
assert BUILD_SPEC and BUILD_SPEC.loader
BUILD_SPEC.loader.exec_module(BUILD)

PILOT_SPEC = importlib.util.spec_from_file_location(
    "validate_fixation_runtime_pilot", SCRIPTS / "validate_fixation_runtime_pilot.py"
)
PILOT = importlib.util.module_from_spec(PILOT_SPEC)
assert PILOT_SPEC and PILOT_SPEC.loader
PILOT_SPEC.loader.exec_module(PILOT)


class FixationRuntimeActivationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = json.loads((ROOT / "data" / "fixation-runtime-bank.json").read_text(encoding="utf-8"))
        cls.legacy = PILOT.extract_module_quiz(
            ROOT / "modules" / "fixation-guide-v3.html",
            module_id="fixation-v3",
            domain="fixation",
            access="sample",
        )
        cls.activation = (ROOT / "assets" / "fixation-runtime-activation.js").read_text(encoding="utf-8")

    def test_public_projection_contains_exactly_ten_approved_sample_questions(self) -> None:
        self.assertEqual(10, len(self.bank))
        self.assertEqual(10, len({item["id"] for item in self.bank}))
        self.assertTrue(all(item["status"] == "approved" for item in self.bank))
        self.assertTrue(all(item["access"] == "sample" for item in self.bank))
        self.assertTrue(all(item["domain"] == "fixation" for item in self.bank))

    def test_public_projection_preserves_legacy_question_content(self) -> None:
        self.assertEqual(len(self.legacy), len(self.bank))
        option_ids = "ABCD"
        for legacy, canonical in zip(self.legacy, self.bank, strict=True):
            self.assertEqual(legacy["stem"], canonical["stem"])
            self.assertEqual(legacy["options"], [item["text"] for item in canonical["options"]])
            self.assertEqual(option_ids[legacy["correct_index"]], canonical["correct_option_id"])
            self.assertEqual(legacy["rationale"], canonical["rationale"])

    def test_every_incorrect_option_has_a_distractor_rationale(self) -> None:
        for question in self.bank:
            expected = {item["id"] for item in question["options"] if item["id"] != question["correct_option_id"]}
            self.assertEqual(expected, set(question["distractor_rationales"]))

    def test_generated_fixation_page_loads_activation_and_runtime_assets(self) -> None:
        required = BUILD.dependency_closure(ROOT)
        for path in (
            Path("assets/question-runtime.js"),
            Path("assets/fixation-canonical-adapter.js"),
            Path("assets/fixation-runtime-activation.js"),
            Path("data/fixation-runtime-bank.json"),
        ):
            self.assertIn(path, required)

        source = (ROOT / "modules" / "fixation-guide-v3.html").read_text(encoding="utf-8")
        rendered = BUILD.rewrite_html(source, "modules/fixation-guide-v3.html", "https://example.test/")
        self.assertEqual(1, rendered.count("fixation-runtime-activation.js"))
        self.assertIn('<script src="../assets/fixation-runtime-activation.js" defer></script>', rendered)

    def test_generated_build_includes_analytics_and_dynamic_dependencies(self) -> None:
        required = BUILD.dependency_closure(ROOT)
        for path in (
            Path("assets/analytics.js"),
            Path("assets/analytics-consent.css"),
            Path("assets/signup.js"),
            Path("assets/authority.js"),
            Path("assets/seo.js"),
            Path("data/analytics-config.json"),
        ):
            self.assertIn(path, required)
            self.assertTrue((ROOT / path).is_file(), path)

    def test_other_pages_do_not_receive_fixation_activation(self) -> None:
        source = (ROOT / "index.html").read_text(encoding="utf-8")
        rendered = BUILD.rewrite_html(source, "index.html", "https://example.test/")
        self.assertNotIn("fixation-runtime-activation.js", rendered)

    def test_activation_has_fallback_duplicate_and_accessibility_boundaries(self) -> None:
        self.assertIn("legacyMarkup", self.activation)
        self.assertIn("form.innerHTML = legacyMarkup", self.activation)
        self.assertIn("runtimeSubmitted", self.activation)
        self.assertIn("stopImmediatePropagation", self.activation)
        self.assertIn("aria-live", self.activation)
        self.assertIn("result.focus", self.activation)
        self.assertIn("htl:quiz-graded", self.activation)
        self.assertIn("questionResults", (ROOT / "assets" / "fixation-canonical-adapter.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
