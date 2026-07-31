from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_authority import validate_authority


class AuthorityValidatorTests(unittest.TestCase):
    def make_root(self) -> Path:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / "data").mkdir()
        (root / "modules").mkdir()
        (root / "assets").mkdir()
        (root / "assets" / "authority.js").write_text("(() => {})();\n", encoding="utf-8")
        (root / "editorial.html").write_text("<!doctype html><title>Editorial</title><h1>Editorial</h1>\n", encoding="utf-8")

        modules = {}
        for index in range(7):
            key = f"module-{index + 1}"
            path = f"modules/module-{index + 1}.html"
            modules[key] = {
                "path": path,
                "title": f"Module {index + 1}",
                "version": "1.1.0",
                "reviewed": "2026-07-31",
                "primaryArea": "Staining",
                "examWeight": "30–40%",
                "secondaryAreas": ["Fixation"],
                "outlineTopics": ["Topic one", "Topic two", "Topic three"],
                "htlEmphasis": "HTL-level reasoning.",
                "questionDifficulties": [
                    "Foundational", "Application", "Troubleshooting", "Foundational", "Application",
                    "Troubleshooting", "Foundational", "Application", "Troubleshooting", "Application"
                ],
                "references": ["Reference one", "Reference two", "Reference three", "Reference four"]
            }
            questions = []
            for question in range(1, 11):
                questions.append(
                    f'<fieldset data-correct="B" data-expl="Explanation {question}.">'
                    f'<legend>{question}. Question</legend>'
                    f'<label><input type="radio" name="q{question}" value="A"> A</label>'
                    f'<label><input type="radio" name="q{question}" value="B"> B</label>'
                    f'<label><input type="radio" name="q{question}" value="C"> C</label>'
                    f'<label><input type="radio" name="q{question}" value="D"> D</label>'
                    '<p class="explanation" hidden></p></fieldset>'
                )
            html = (
                '<!doctype html><html lang="en"><head><title>Module</title></head>'
                f'<body data-page="{key}"><section id="quiz">{"".join(questions)}</section></body></html>'
            )
            (root / path).write_text(html, encoding="utf-8")

        data = {
            "schemaVersion": 1,
            "editorialReviewDate": "2026-07-31",
            "examGuideline": {
                "title": "Guideline",
                "revised": "2025-12-05",
                "url": "https://example.org/guideline.pdf",
                "credentialPage": "https://example.org/credential",
                "readingList": "https://example.org/reading"
            },
            "difficultyDefinitions": {
                "Foundational": "Definition",
                "Application": "Definition",
                "Troubleshooting": "Definition"
            },
            "modules": modules
        }
        (root / "data" / "module-authority.json").write_text(json.dumps(data), encoding="utf-8")
        return root

    def load_data(self, root: Path) -> dict:
        return json.loads((root / "data" / "module-authority.json").read_text(encoding="utf-8"))

    def save_data(self, root: Path, data: dict) -> None:
        (root / "data" / "module-authority.json").write_text(json.dumps(data), encoding="utf-8")

    def test_valid_contract_passes(self) -> None:
        self.assertEqual(validate_authority(self.make_root()), [])

    def test_difficulty_count_mismatch_is_reported(self) -> None:
        root = self.make_root()
        data = self.load_data(root)
        data["modules"]["module-1"]["questionDifficulties"].pop()
        self.save_data(root, data)
        messages = [issue.message for issue in validate_authority(root)]
        self.assertIn("questionDifficulties must contain exactly 10 entries", messages)

    def test_invalid_correct_answer_is_reported(self) -> None:
        root = self.make_root()
        path = root / "modules" / "module-1.html"
        path.write_text(path.read_text(encoding="utf-8").replace('data-correct="B"', 'data-correct="Z"', 1), encoding="utf-8")
        messages = [issue.message for issue in validate_authority(root)]
        self.assertIn('data-correct value "Z" does not match a choice', messages)

    def test_missing_editorial_page_is_reported(self) -> None:
        root = self.make_root()
        (root / "editorial.html").unlink()
        messages = [issue.message for issue in validate_authority(root)]
        self.assertIn("Missing public editorial standards and corrections page", messages)


if __name__ == "__main__":
    unittest.main()
