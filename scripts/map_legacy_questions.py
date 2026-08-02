#!/usr/bin/env python3
"""Map neutral legacy question records into Layer 16.1 canonical drafts."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any

OPTION_IDS = ("A", "B", "C", "D")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "question"


def stable_id(source_path: str, source_key: str, stem: str) -> str:
    digest = hashlib.sha256(f"{source_path}\0{source_key}\0{stem}".encode("utf-8")).hexdigest()[:12]
    return f"legacy-{slugify(Path(source_path).stem)}-{slugify(source_key)}-{digest}"


def map_record(record: dict[str, Any], *, now: str | None = None) -> tuple[dict[str, Any], list[str]]:
    issues: list[str] = []
    now = now or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    source_path = str(record.get("source_path", "unknown"))
    source_key = str(record.get("source_key", "unknown"))
    stem = str(record.get("stem", "")).strip()
    raw_options = record.get("options", [])
    if not isinstance(raw_options, list) or len(raw_options) != 4:
        issues.append("options_not_exactly_four")
        raw_options = list(raw_options)[:4] if isinstance(raw_options, list) else []
        while len(raw_options) < 4:
            raw_options.append("")
    options = [{"id": oid, "text": str(text).strip()} for oid, text in zip(OPTION_IDS, raw_options)]

    answer_index = record.get("correct_index")
    if not isinstance(answer_index, int) or answer_index not in range(4):
        issues.append("missing_or_invalid_correct_index")
        answer_index = 0
    correct_option_id = OPTION_IDS[answer_index]

    rationale = str(record.get("rationale", "")).strip()
    if not rationale:
        issues.append("missing_correct_rationale")
        rationale = "Migration gap: the original source does not include a complete answer rationale."

    source_distractors = record.get("distractor_rationales")
    distractor_rationales: dict[str, str] = {}
    if isinstance(source_distractors, dict):
        for oid in OPTION_IDS:
            if oid == correct_option_id:
                continue
            value = str(source_distractors.get(oid, "")).strip()
            if value:
                distractor_rationales[oid] = value
    for oid in OPTION_IDS:
        if oid == correct_option_id:
            continue
        if oid not in distractor_rationales:
            issues.append(f"missing_distractor_rationale_{oid}")
            distractor_rationales[oid] = "Migration gap: this distractor requires an authored explanation before approval."

    domain = str(record.get("domain", "")).strip()
    topic = str(record.get("topic", "")).strip()
    if not domain:
        issues.append("missing_domain")
        domain = "laboratory_operations"
    if not topic:
        issues.append("missing_topic")
        topic = "migration_review_required"

    question = {
        "id": stable_id(source_path, source_key, stem),
        "status": "draft",
        "access": str(record.get("access", "premium")),
        "certification_scope": str(record.get("certification_scope", "HT_HTL")),
        "domain": domain,
        "topic": topic,
        "difficulty": str(record.get("difficulty", "applied")),
        "cognitive_level": str(record.get("cognitive_level", "application")),
        "stem": stem,
        "options": options,
        "correct_option_id": correct_option_id,
        "rationale": rationale,
        "distractor_rationales": distractor_rationales,
        "learning_objective": str(record.get("learning_objective", "Review and apply the concept represented by this migrated question.")),
        "lesson_refs": list(record.get("lesson_refs", ["migration-review"])),
        "references": [{
            "label": "Legacy source provenance",
            "locator": f"{source_path}#{source_key}",
            "notes": "Mechanically migrated; educational content and review status require verification.",
        }],
        "review": {
            "scientific": {"status": "pending", "reviewer": None, "reviewed_at": None, "notes": ""},
            "editorial": {"status": "pending", "reviewer": None, "reviewed_at": None, "notes": ""},
        },
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    return question, sorted(set(issues))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--issues", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(source, list):
        raise SystemExit("Input must be a JSON array of neutral legacy records.")
    mapped: list[dict[str, Any]] = []
    issue_rows: list[dict[str, Any]] = []
    for index, record in enumerate(source):
        question, issues = map_record(record)
        mapped.append(question)
        issue_rows.append({
            "source_path": record.get("source_path"),
            "source_key": record.get("source_key", index),
            "canonical_id": question["id"],
            "issues": issues,
            "ready_for_review": not issues,
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.issues.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(mapped, indent=2) + "\n", encoding="utf-8")
    args.issues.write_text(json.dumps(issue_rows, indent=2) + "\n", encoding="utf-8")
    print(f"Mapped {len(mapped)} legacy question(s); {sum(bool(row['issues']) for row in issue_rows)} require migration review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
