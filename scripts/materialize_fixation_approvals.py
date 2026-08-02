#!/usr/bin/env python3
"""Materialize exact-version Fixation approval events and approved records."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from question_review import content_digest, load_checklists, publication_gate, validate_event_log


def load_questions(directory: Path) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    for path in sorted(directory.glob("q[0-9][0-9].json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list) or len(payload) != 1:
            raise ValueError(f"{path} must contain exactly one question record")
        questions.append(payload[0])
    return questions


def make_event(question: dict[str, Any], attestation: dict[str, Any], review_type: str) -> dict[str, Any]:
    reviewed_at = attestation["approved_at"]
    return {
        "event_id": f"{question['id']}-v{question['version']}-{review_type}-approved-20260802",
        "question_id": question["id"],
        "question_version": question["version"],
        "content_digest": content_digest(question),
        "review_type": review_type,
        "decision": "approved",
        "reviewer": attestation["reviewer"],
        "reviewed_at": reviewed_at,
        "confidence": attestation["confidence"],
        "checklist": attestation[f"{review_type}_checklist"],
        "verified_references": attestation["verified_references"] if review_type == "scientific" else [],
        "comments": attestation["comments"],
        "issue_codes": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions-dir", type=Path, default=Path("content/question-bank/review/fixation"))
    parser.add_argument("--attestation", type=Path, default=Path("content/question-bank/review/fixation/approval-attestation.json"))
    parser.add_argument("--checklists", type=Path, default=Path("content/question-bank/review-checklists.json"))
    parser.add_argument("--events-output", type=Path, required=True)
    parser.add_argument("--approved-output", type=Path, required=True)
    parser.add_argument("--report-output", type=Path, required=True)
    args = parser.parse_args()

    questions = load_questions(args.questions_dir)
    attestation = json.loads(args.attestation.read_text(encoding="utf-8"))
    checklists = load_checklists(args.checklists)

    expected_ids = set(attestation["question_ids"])
    actual_ids = {question["id"] for question in questions}
    if len(questions) != 10 or actual_ids != expected_ids:
        raise SystemExit("Attestation scope does not exactly match the ten canonical Fixation questions.")
    if attestation.get("decision") != "approved":
        raise SystemExit("Attestation decision is not approved.")

    events: list[dict[str, Any]] = []
    for question in questions:
        events.append(make_event(question, attestation, "scientific"))
        events.append(make_event(question, attestation, "editorial"))

    event_errors = validate_event_log(events, checklists)
    gates = [publication_gate(question, events, checklists) for question in questions]
    if event_errors or any(not gate["publishable"] for gate in gates):
        raise SystemExit(json.dumps({"event_errors": event_errors, "questions": gates}, indent=2))

    approved: list[dict[str, Any]] = []
    for question in questions:
        record = dict(question)
        record["status"] = "approved"
        record["review"] = {
            "scientific": {
                "status": "approved",
                "reviewer": attestation["reviewer"]["display_name"],
                "reviewed_at": attestation["approved_at"],
                "notes": "Approved through exact-version scientific review event.",
            },
            "editorial": {
                "status": "approved",
                "reviewer": attestation["reviewer"]["display_name"],
                "reviewed_at": attestation["approved_at"],
                "notes": "Approved through exact-version editorial review event.",
            },
        }
        record["updated_at"] = attestation["approved_at"]
        approved.append(record)

    args.events_output.parent.mkdir(parents=True, exist_ok=True)
    args.approved_output.parent.mkdir(parents=True, exist_ok=True)
    args.report_output.parent.mkdir(parents=True, exist_ok=True)
    args.events_output.write_text(json.dumps(events, indent=2) + "\n", encoding="utf-8")
    args.approved_output.write_text(json.dumps(approved, indent=2) + "\n", encoding="utf-8")
    args.report_output.write_text(json.dumps({"event_errors": [], "questions": gates}, indent=2) + "\n", encoding="utf-8")
    print("Materialized 20 approval events and 10 approved Fixation questions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
