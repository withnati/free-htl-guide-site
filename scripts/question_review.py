#!/usr/bin/env python3
"""Validate append-only question review events and evaluate publication gates."""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
from typing import Any

REVIEW_TYPES = {"scientific", "editorial"}
DECISIONS = {"approved", "changes_requested"}
CONFIDENCE = {"high", "medium", "low"}
DIGEST_FIELDS = (
    "id", "version", "access", "certification_scope", "domain", "topic",
    "difficulty", "cognitive_level", "stem", "options", "correct_option_id",
    "rationale", "distractor_rationales", "learning_objective", "lesson_refs",
    "references",
)


def canonical_payload(question: dict[str, Any]) -> dict[str, Any]:
    return {field: question.get(field) for field in DIGEST_FIELDS}


def content_digest(question: dict[str, Any]) -> str:
    encoded = json.dumps(canonical_payload(question), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def valid_datetime(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def load_checklists(path: Path) -> dict[str, dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {kind: dict(data[kind]) for kind in REVIEW_TYPES}


def validate_event(event: dict[str, Any], checklists: dict[str, dict[str, str]]) -> list[str]:
    errors: list[str] = []
    required = {
        "event_id", "question_id", "question_version", "content_digest",
        "review_type", "decision", "reviewer", "reviewed_at", "confidence",
        "checklist", "verified_references", "comments", "issue_codes",
    }
    missing = sorted(required - set(event))
    if missing:
        return [f"missing fields: {', '.join(missing)}"]
    review_type = event.get("review_type")
    if review_type not in REVIEW_TYPES:
        errors.append("invalid review_type")
        return errors
    if event.get("decision") not in DECISIONS:
        errors.append("invalid decision")
    if event.get("confidence") not in CONFIDENCE:
        errors.append("invalid confidence")
    if not valid_datetime(event.get("reviewed_at")):
        errors.append("reviewed_at must be an ISO date-time")
    if not isinstance(event.get("question_version"), int) or event["question_version"] < 1:
        errors.append("question_version must be a positive integer")
    digest = event.get("content_digest")
    if not isinstance(digest, str) or not digest.startswith("sha256:") or len(digest) != 71:
        errors.append("content_digest must be a SHA-256 digest")
    reviewer = event.get("reviewer")
    if not isinstance(reviewer, dict) or not all(str(reviewer.get(key, "")).strip() for key in ("id", "display_name", "role_note")):
        errors.append("reviewer requires id, display_name, and role_note")
    expected = set(checklists[review_type])
    actual = set(event.get("checklist") or {})
    if actual != expected:
        errors.append(f"checklist must contain exactly the controlled {review_type} checklist keys")
    decision = event.get("decision")
    checklist_values = event.get("checklist") or {}
    if decision == "approved" and not all(checklist_values.values()):
        errors.append("approved review requires every checklist item to pass")
    references = event.get("verified_references")
    if not isinstance(references, list):
        errors.append("verified_references must be an array")
    elif review_type == "scientific" and decision == "approved" and not references:
        errors.append("scientific approval requires at least one verified reference locator")
    issue_codes = event.get("issue_codes")
    if not isinstance(issue_codes, list) or len(issue_codes) != len(set(issue_codes)):
        errors.append("issue_codes must be a unique array")
    if decision == "approved" and issue_codes:
        errors.append("approved review cannot retain unresolved issue codes")
    if decision == "changes_requested" and not str(event.get("comments", "")).strip():
        errors.append("changes_requested requires reviewer comments")
    return errors


def validate_event_log(events: list[dict[str, Any]], checklists: dict[str, dict[str, str]]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    event_by_id: dict[str, dict[str, Any]] = {}
    for index, event in enumerate(events):
        prefix = f"event[{index}]"
        for error in validate_event(event, checklists):
            errors.append(f"{prefix}: {error}")
        event_id = event.get("event_id")
        if event_id in seen_ids:
            errors.append(f"{prefix}: duplicate event_id {event_id}")
        elif isinstance(event_id, str):
            seen_ids.add(event_id)
            event_by_id[event_id] = event
        supersedes = event.get("supersedes_event_id")
        if supersedes:
            prior = event_by_id.get(supersedes)
            if prior is None:
                errors.append(f"{prefix}: supersedes_event_id must reference an earlier event")
            elif prior.get("question_id") != event.get("question_id") or prior.get("review_type") != event.get("review_type"):
                errors.append(f"{prefix}: superseded event must match question and review type")
    return errors


def active_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    superseded = {event.get("supersedes_event_id") for event in events if event.get("supersedes_event_id")}
    return [event for event in events if event.get("event_id") not in superseded]


def publication_gate(question: dict[str, Any], events: list[dict[str, Any]], checklists: dict[str, dict[str, str]]) -> dict[str, Any]:
    failures: list[str] = []
    digest = content_digest(question)
    relevant = [
        event for event in active_events(events)
        if event.get("question_id") == question.get("id")
        and event.get("question_version") == question.get("version")
    ]
    for review_type in ("scientific", "editorial"):
        matching = [event for event in relevant if event.get("review_type") == review_type]
        if not matching:
            failures.append(f"missing_{review_type}_review")
            continue
        latest = max(matching, key=lambda event: event.get("reviewed_at", ""))
        if latest.get("content_digest") != digest:
            failures.append(f"stale_{review_type}_review_digest")
        if latest.get("decision") != "approved":
            failures.append(f"{review_type}_changes_requested")
        if validate_event(latest, checklists):
            failures.append(f"invalid_{review_type}_review_event")
    if question.get("status") == "retired":
        failures.append("question_retired")
    if question.get("access") not in {"sample", "premium"}:
        failures.append("access_not_confirmed")
    distractors = question.get("distractor_rationales") or {}
    expected = {"A", "B", "C", "D"} - {question.get("correct_option_id")}
    if set(distractors) != expected or any("Migration gap" in str(value) for value in distractors.values()):
        failures.append("distractor_rationales_incomplete")
    return {
        "question_id": question.get("id"),
        "question_version": question.get("version"),
        "content_digest": digest,
        "publishable": not failures,
        "failures": sorted(set(failures)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", type=Path, required=True)
    parser.add_argument("--events", type=Path, required=True)
    parser.add_argument("--checklists", type=Path, default=Path("content/question-bank/review-checklists.json"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    questions = json.loads(args.questions.read_text(encoding="utf-8"))
    events = json.loads(args.events.read_text(encoding="utf-8"))
    checklists = load_checklists(args.checklists)
    event_errors = validate_event_log(events, checklists)
    report = {
        "event_errors": event_errors,
        "questions": [publication_gate(question, events, checklists) for question in questions],
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if event_errors or any(not item["publishable"] for item in report["questions"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
