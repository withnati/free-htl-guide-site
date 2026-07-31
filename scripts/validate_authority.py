#!/usr/bin/env python3
"""Validate module authority metadata and quiz integrity without dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ALLOWED_DIFFICULTIES = {"Foundational", "Application", "Troubleshooting"}
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
WEIGHT_RE = re.compile(r"^\d{1,2}–\d{1,2}%$")


@dataclass(order=True, frozen=True)
class Issue:
    path: str
    message: str


@dataclass
class QuizQuestion:
    correct: str = ""
    explanation: str = ""
    names: list[str] = field(default_factory=list)
    values: list[str] = field(default_factory=list)
    explanation_nodes: int = 0


@dataclass
class ModuleDocument:
    page_key: str = ""
    questions: list[QuizQuestion] = field(default_factory=list)


class ModuleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.document = ModuleDocument()
        self.current_question: QuizQuestion | None = None
        self.in_quiz = False
        self.quiz_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name.lower(): (value or "") for name, value in attrs}
        tag = tag.lower()

        if tag == "body":
            self.document.page_key = attr_map.get("data-page", "").strip()

        if tag == "section" and attr_map.get("id") == "quiz":
            self.in_quiz = True
            self.quiz_depth = 1
            return

        if self.in_quiz and tag == "section":
            self.quiz_depth += 1

        if self.in_quiz and tag == "fieldset" and "data-correct" in attr_map:
            self.current_question = QuizQuestion(
                correct=attr_map.get("data-correct", "").strip(),
                explanation=attr_map.get("data-expl", "").strip(),
            )
            self.document.questions.append(self.current_question)
            return

        if self.current_question and tag == "input" and attr_map.get("type", "").lower() == "radio":
            self.current_question.names.append(attr_map.get("name", "").strip())
            self.current_question.values.append(attr_map.get("value", "").strip())

        if self.current_question and tag == "p":
            classes = set(attr_map.get("class", "").split())
            if "explanation" in classes:
                self.current_question.explanation_nodes += 1

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "fieldset":
            self.current_question = None
        if self.in_quiz and tag == "section":
            self.quiz_depth -= 1
            if self.quiz_depth <= 0:
                self.in_quiz = False
                self.quiz_depth = 0


def valid_https_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def parse_iso_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_module(path: Path) -> ModuleDocument:
    parser = ModuleParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser.document


def validate_authority(root: Path) -> list[Issue]:
    issues: list[Issue] = []
    metadata_path = root / "data" / "module-authority.json"
    relative_metadata = "data/module-authority.json"

    if not metadata_path.exists():
        return [Issue(relative_metadata, "Missing authority metadata file")]

    try:
        data = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return [Issue(relative_metadata, f"Cannot parse authority metadata: {exc}")]

    if data.get("schemaVersion") != 1:
        issues.append(Issue(relative_metadata, "schemaVersion must be 1"))

    overall_review = parse_iso_date(data.get("editorialReviewDate"))
    if overall_review is None:
        issues.append(Issue(relative_metadata, "editorialReviewDate must be an ISO date"))
    elif overall_review > date.today():
        issues.append(Issue(relative_metadata, "editorialReviewDate cannot be in the future"))

    guideline = data.get("examGuideline")
    if not isinstance(guideline, dict):
        issues.append(Issue(relative_metadata, "examGuideline must be an object"))
        guideline = {}

    guideline_date = parse_iso_date(guideline.get("revised"))
    if guideline_date is None:
        issues.append(Issue(relative_metadata, "examGuideline.revised must be an ISO date"))
    elif guideline_date > date.today():
        issues.append(Issue(relative_metadata, "examGuideline.revised cannot be in the future"))

    for field_name in ("url", "credentialPage", "readingList"):
        if not valid_https_url(guideline.get(field_name)):
            issues.append(Issue(relative_metadata, f"examGuideline.{field_name} must be a valid HTTPS URL"))

    definitions = data.get("difficultyDefinitions")
    if not isinstance(definitions, dict) or set(definitions) != ALLOWED_DIFFICULTIES:
        issues.append(Issue(relative_metadata, "difficultyDefinitions must define Foundational, Application, and Troubleshooting"))

    modules = data.get("modules")
    if not isinstance(modules, dict):
        return issues + [Issue(relative_metadata, "modules must be an object")]
    if len(modules) != 7:
        issues.append(Issue(relative_metadata, f"Expected 7 governed modules; found {len(modules)}"))

    seen_paths: set[str] = set()
    total_questions = 0

    for page_key, module in sorted(modules.items()):
        location = f"{relative_metadata}#{page_key}"
        if not isinstance(module, dict):
            issues.append(Issue(location, "Module entry must be an object"))
            continue

        path_value = module.get("path")
        if not isinstance(path_value, str) or not path_value.startswith("modules/") or not path_value.endswith(".html"):
            issues.append(Issue(location, "path must identify a module HTML file"))
            continue
        if path_value in seen_paths:
            issues.append(Issue(location, f"Duplicate module path: {path_value}"))
        seen_paths.add(path_value)

        module_path = root / path_value
        if not module_path.exists():
            issues.append(Issue(path_value, "Module file is missing"))
            continue

        for required_text in ("title", "primaryArea", "examWeight", "htlEmphasis"):
            if not isinstance(module.get(required_text), str) or not module[required_text].strip():
                issues.append(Issue(location, f"{required_text} must be non-empty text"))

        if not VERSION_RE.fullmatch(str(module.get("version", ""))):
            issues.append(Issue(location, "version must use semantic x.y.z format"))

        reviewed = parse_iso_date(module.get("reviewed"))
        if reviewed is None:
            issues.append(Issue(location, "reviewed must be an ISO date"))
        elif reviewed > date.today():
            issues.append(Issue(location, "reviewed cannot be in the future"))
        elif guideline_date and reviewed < guideline_date:
            issues.append(Issue(location, "reviewed date predates the examination guideline revision"))

        if not WEIGHT_RE.fullmatch(str(module.get("examWeight", ""))):
            issues.append(Issue(location, "examWeight must use an en-dash range such as 15–25%"))

        topics = module.get("outlineTopics")
        if not isinstance(topics, list) or len(topics) < 3 or not all(isinstance(item, str) and item.strip() for item in topics):
            issues.append(Issue(location, "outlineTopics must contain at least 3 non-empty entries"))

        references = module.get("references")
        if not isinstance(references, list) or len(references) < 4 or not all(isinstance(item, str) and item.strip() for item in references):
            issues.append(Issue(location, "references must contain at least 4 non-empty entries"))

        difficulties = module.get("questionDifficulties")
        if not isinstance(difficulties, list) or len(difficulties) != 10:
            issues.append(Issue(location, "questionDifficulties must contain exactly 10 entries"))
            difficulties = []
        invalid_difficulties = sorted({item for item in difficulties if item not in ALLOWED_DIFFICULTIES})
        if invalid_difficulties:
            issues.append(Issue(location, f"Unknown question difficulty: {', '.join(map(str, invalid_difficulties))}"))

        try:
            document = parse_module(module_path)
        except (OSError, UnicodeError) as exc:
            issues.append(Issue(path_value, f"Cannot read module: {exc}"))
            continue

        if document.page_key != page_key:
            issues.append(Issue(path_value, f'body data-page must be "{page_key}"; found "{document.page_key}"'))

        question_count = len(document.questions)
        total_questions += question_count
        if question_count != 10:
            issues.append(Issue(path_value, f"Expected 10 quiz questions; found {question_count}"))

        for index, question in enumerate(document.questions, start=1):
            question_location = f"{path_value} question {index}"
            if not question.explanation:
                issues.append(Issue(question_location, "data-expl must be non-empty"))
            if len(question.values) != 4:
                issues.append(Issue(question_location, f"Expected 4 radio choices; found {len(question.values)}"))
            if any(not value for value in question.values):
                issues.append(Issue(question_location, "Every radio choice must have a value"))
            if len(set(question.values)) != len(question.values):
                issues.append(Issue(question_location, "Radio choice values must be unique"))
            if question.correct not in question.values:
                issues.append(Issue(question_location, f'data-correct value "{question.correct}" does not match a choice'))
            non_empty_names = {name for name in question.names if name}
            if len(non_empty_names) != 1 or len(question.names) != len(question.values):
                issues.append(Issue(question_location, "All choices must share one non-empty radio name"))
            if question.explanation_nodes != 1:
                issues.append(Issue(question_location, f"Expected one explanation element; found {question.explanation_nodes}"))

    if total_questions != 70:
        issues.append(Issue(relative_metadata, f"Expected 70 governed questions; found {total_questions}"))

    editorial = root / "editorial.html"
    if not editorial.exists():
        issues.append(Issue("editorial.html", "Missing public editorial standards and corrections page"))

    authority_script = root / "assets" / "authority.js"
    if not authority_script.exists():
        issues.append(Issue("assets/authority.js", "Missing authority renderer"))

    return sorted(issues)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Repository root")
    args = parser.parse_args(argv)
    root = args.root.resolve()

    issues = validate_authority(root)
    if issues:
        print(f"Authority validation failed with {len(issues)} issue(s):")
        for issue in issues:
            print(f"- {issue.path}: {issue.message}")
        return 1

    print("Authority validation passed: 7 modules, 70 questions, and editorial metadata are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
