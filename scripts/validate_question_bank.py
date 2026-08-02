#!/usr/bin/env python3
"""Validate FHL question-bank records and public/Premium boundaries."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
from typing import Any

ALLOWED_STATUS = {"draft", "scientific_review", "editorial_review", "approved", "retired"}
ALLOWED_ACCESS = {"sample", "premium"}
ALLOWED_SCOPE = {"HT", "HTL", "HT_HTL"}
ALLOWED_DOMAIN = {"fixation", "processing", "embedding", "microtomy", "staining", "laboratory_operations", "special_procedures"}
ALLOWED_DIFFICULTY = {"foundational", "applied", "advanced"}
ALLOWED_COGNITIVE = {"recall", "application", "analysis"}
OPTION_IDS = ["A", "B", "C", "D"]
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_records(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path}: root must be an array")
    return data


def validate_record(question: dict[str, Any], source: Path, index: int) -> list[str]:
    errors: list[str] = []
    label = f"{source}[{index}]"
    required = {
        "id", "status", "access", "certification_scope", "domain", "topic",
        "difficulty", "cognitive_level", "stem", "options", "correct_option_id",
        "rationale", "distractor_rationales", "learning_objective", "lesson_refs",
        "references", "review", "version", "created_at", "updated_at",
    }
    missing = sorted(required - question.keys())
    if missing:
        errors.append(f"{label}: missing fields: {', '.join(missing)}")
        return errors

    qid = question["id"]
    if not isinstance(qid, str) or not ID_RE.fullmatch(qid):
        errors.append(f"{label}: invalid stable id")
    for field, allowed in (
        ("status", ALLOWED_STATUS), ("access", ALLOWED_ACCESS),
        ("certification_scope", ALLOWED_SCOPE), ("domain", ALLOWED_DOMAIN),
        ("difficulty", ALLOWED_DIFFICULTY), ("cognitive_level", ALLOWED_COGNITIVE),
    ):
        if question[field] not in allowed:
            errors.append(f"{label}: invalid {field}: {question[field]!r}")

    options = question["options"]
    if not isinstance(options, list) or len(options) != 4:
        errors.append(f"{label}: options must contain exactly four choices")
    else:
        ids = [option.get("id") for option in options if isinstance(option, dict)]
        if ids != OPTION_IDS:
            errors.append(f"{label}: option IDs must appear once in A, B, C, D order")
        texts = [str(option.get("text", "")).strip().casefold() for option in options if isinstance(option, dict)]
        if len(set(texts)) != 4 or any(not text for text in texts):
            errors.append(f"{label}: option text must be non-empty and unique")

    correct = question["correct_option_id"]
    if correct not in OPTION_IDS:
        errors.append(f"{label}: correct_option_id must match A, B, C, or D")
    distractors = question["distractor_rationales"]
    expected_distractors = set(OPTION_IDS) - {correct}
    if not isinstance(distractors, dict) or set(distractors) != expected_distractors:
        errors.append(f"{label}: distractor rationales must exist only for the three incorrect options")

    review = question["review"]
    if not isinstance(review, dict) or set(review) != {"scientific", "editorial"}:
        errors.append(f"{label}: review must include scientific and editorial records")
    elif question["status"] == "approved":
        for review_type in ("scientific", "editorial"):
            record = review.get(review_type, {})
            if record.get("status") != "approved" or not record.get("reviewer") or not record.get("reviewed_at"):
                errors.append(f"{label}: approved question requires completed {review_type} review")

    if not isinstance(question["version"], int) or question["version"] < 1:
        errors.append(f"{label}: version must be a positive integer")
    if not isinstance(question["lesson_refs"], list) or not question["lesson_refs"]:
        errors.append(f"{label}: at least one lesson reference is required")
    if not isinstance(question["references"], list) or not question["references"]:
        errors.append(f"{label}: at least one internal review reference is required")
    if len(str(question["stem"]).strip()) < 20:
        errors.append(f"{label}: stem is too short")
    if len(str(question["rationale"]).strip()) < 30:
        errors.append(f"{label}: rationale is too short")
    return errors


def validate_paths(paths: list[Path], public_root: Path | None = None) -> list[str]:
    errors: list[str] = []
    seen: dict[str, Path] = {}
    for path in paths:
        try:
            records = load_records(path)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            errors.append(str(exc))
            continue
        for index, question in enumerate(records):
            errors.extend(validate_record(question, path, index))
            qid = question.get("id")
            if isinstance(qid, str):
                if qid in seen:
                    errors.append(f"{path}[{index}]: duplicate id {qid!r}; first found in {seen[qid]}")
                else:
                    seen[qid] = path
            if public_root and path.is_relative_to(public_root) and question.get("access") != "sample":
                errors.append(f"{path}[{index}]: Premium question present inside public content root")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--public-root", type=Path)
    args = parser.parse_args()
    errors = validate_paths(args.paths, args.public_root)
    if errors:
        print("Question-bank validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Question-bank validation passed for {len(args.paths)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
