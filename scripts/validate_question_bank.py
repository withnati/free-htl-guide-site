#!/usr/bin/env python3
"""Validate FHL question-bank records and public/Premium boundaries."""
from __future__ import annotations

import argparse
from datetime import datetime
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
ALLOWED_REVIEW_STATUS = {"pending", "approved", "changes_requested"}
OPTION_IDS = ["A", "B", "C", "D"]
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TOPIC_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")


def load_records(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path}: root must be an array")
    if not all(isinstance(item, dict) for item in data):
        raise ValueError(f"{path}: every array item must be an object")
    return data


def load_taxonomy(path: Path | None) -> dict[str, set[str]]:
    if path is None:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    domains = data.get("domains")
    if not isinstance(domains, dict):
        raise ValueError(f"{path}: taxonomy must contain a domains object")
    result: dict[str, set[str]] = {}
    for domain, record in domains.items():
        if not isinstance(record, dict) or not isinstance(record.get("topics"), list):
            raise ValueError(f"{path}: domain {domain!r} must contain a topics array")
        result[domain] = set(record["topics"])
    return result


def valid_datetime(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def validate_review_record(record: Any, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(record, dict):
        return [f"{label}: review record must be an object"]
    status = record.get("status")
    if status not in ALLOWED_REVIEW_STATUS:
        errors.append(f"{label}: invalid review status")
    reviewed_at = record.get("reviewed_at")
    if reviewed_at is not None and not valid_datetime(reviewed_at):
        errors.append(f"{label}: reviewed_at must be an ISO date-time or null")
    if status == "approved" and (not record.get("reviewer") or not reviewed_at):
        errors.append(f"{label}: approved review requires reviewer and reviewed_at")
    return errors


def validate_record(
    question: dict[str, Any], source: Path, index: int,
    taxonomy: dict[str, set[str]] | None = None,
) -> list[str]:
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
    if not isinstance(qid, str) or not ID_RE.fullmatch(qid) or not 8 <= len(qid) <= 96:
        errors.append(f"{label}: invalid stable id")
    for field, allowed in (
        ("status", ALLOWED_STATUS), ("access", ALLOWED_ACCESS),
        ("certification_scope", ALLOWED_SCOPE), ("domain", ALLOWED_DOMAIN),
        ("difficulty", ALLOWED_DIFFICULTY), ("cognitive_level", ALLOWED_COGNITIVE),
    ):
        if question[field] not in allowed:
            errors.append(f"{label}: invalid {field}: {question[field]!r}")

    topic = question["topic"]
    if not isinstance(topic, str) or not TOPIC_RE.fullmatch(topic):
        errors.append(f"{label}: invalid topic format")
    domain = question["domain"]
    if taxonomy and domain in taxonomy and topic not in taxonomy[domain]:
        errors.append(f"{label}: topic {topic!r} is not allowed for domain {domain!r}")

    options = question["options"]
    if not isinstance(options, list) or len(options) != 4:
        errors.append(f"{label}: options must contain exactly four choices")
    else:
        ids = [option.get("id") for option in options if isinstance(option, dict)]
        if ids != OPTION_IDS:
            errors.append(f"{label}: option IDs must appear once in A, B, C, D order")
        texts = [str(option.get("text", "")).strip().casefold() for option in options if isinstance(option, dict)]
        if len(texts) != 4 or len(set(texts)) != 4 or any(not text for text in texts):
            errors.append(f"{label}: option text must be non-empty and unique")

    correct = question["correct_option_id"]
    if correct not in OPTION_IDS:
        errors.append(f"{label}: correct_option_id must match A, B, C, or D")
    distractors = question["distractor_rationales"]
    expected_distractors = set(OPTION_IDS) - {correct}
    if not isinstance(distractors, dict) or set(distractors) != expected_distractors:
        errors.append(f"{label}: distractor rationales must exist only for the three incorrect options")
    elif any(len(str(value).strip()) < 10 for value in distractors.values()):
        errors.append(f"{label}: each distractor rationale must be at least 10 characters")

    review = question["review"]
    if not isinstance(review, dict) or set(review) != {"scientific", "editorial"}:
        errors.append(f"{label}: review must include scientific and editorial records")
    else:
        for review_type in ("scientific", "editorial"):
            errors.extend(validate_review_record(review[review_type], f"{label}: {review_type}"))
        if question["status"] == "approved":
            for review_type in ("scientific", "editorial"):
                if review[review_type].get("status") != "approved":
                    errors.append(f"{label}: approved question requires completed {review_type} review")

    if not isinstance(question["version"], int) or isinstance(question["version"], bool) or question["version"] < 1:
        errors.append(f"{label}: version must be a positive integer")
    lesson_refs = question["lesson_refs"]
    if not isinstance(lesson_refs, list) or not lesson_refs:
        errors.append(f"{label}: at least one lesson reference is required")
    elif len(lesson_refs) != len(set(lesson_refs)) or any(not isinstance(ref, str) or not ID_RE.fullmatch(ref) for ref in lesson_refs):
        errors.append(f"{label}: lesson references must be unique stable slugs")
    references = question["references"]
    if not isinstance(references, list) or not references:
        errors.append(f"{label}: at least one internal review reference is required")
    elif any(not isinstance(ref, dict) or not str(ref.get("label", "")).strip() or not str(ref.get("locator", "")).strip() for ref in references):
        errors.append(f"{label}: each reference requires a label and locator")
    if len(str(question["stem"]).strip()) < 20:
        errors.append(f"{label}: stem is too short")
    if len(str(question["rationale"]).strip()) < 30:
        errors.append(f"{label}: rationale is too short")
    if len(str(question["learning_objective"]).strip()) < 15:
        errors.append(f"{label}: learning objective is too short")
    for field in ("created_at", "updated_at"):
        if not valid_datetime(question[field]):
            errors.append(f"{label}: {field} must be an ISO date-time")
    if valid_datetime(question["created_at"]) and valid_datetime(question["updated_at"]):
        created = datetime.fromisoformat(question["created_at"].replace("Z", "+00:00"))
        updated = datetime.fromisoformat(question["updated_at"].replace("Z", "+00:00"))
        if updated < created:
            errors.append(f"{label}: updated_at cannot precede created_at")
    return errors


def validate_paths(
    paths: list[Path], public_root: Path | None = None,
    taxonomy: dict[str, set[str]] | None = None,
) -> list[str]:
    errors: list[str] = []
    seen: dict[str, Path] = {}
    public_root = public_root.resolve() if public_root else None
    for path in paths:
        try:
            records = load_records(path)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            errors.append(str(exc))
            continue
        resolved = path.resolve()
        for index, question in enumerate(records):
            errors.extend(validate_record(question, path, index, taxonomy))
            qid = question.get("id")
            if isinstance(qid, str):
                if qid in seen:
                    errors.append(f"{path}[{index}]: duplicate id {qid!r}; first found in {seen[qid]}")
                else:
                    seen[qid] = path
            if public_root and resolved.is_relative_to(public_root) and question.get("access") != "sample":
                errors.append(f"{path}[{index}]: Premium question present inside public content root")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--public-root", type=Path)
    parser.add_argument("--taxonomy", type=Path)
    args = parser.parse_args()
    try:
        taxonomy = load_taxonomy(args.taxonomy)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Question-bank validation failed:\n- {exc}")
        return 1
    errors = validate_paths(args.paths, args.public_root, taxonomy)
    if errors:
        print("Question-bank validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Question-bank validation passed for {len(args.paths)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
