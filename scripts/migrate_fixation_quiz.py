#!/usr/bin/env python3
"""Generate canonical Fixation draft questions and the explicit review-gap report."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from map_legacy_questions import map_record

DEFAULT_INPUT = Path("content/question-bank/migration/fixation-v3-neutral.json")
DEFAULT_OUTPUT = Path("content/question-bank/migration/fixation-v3-canonical-draft.json")
DEFAULT_ISSUES = Path("content/question-bank/migration/fixation-v3-review-gaps.json")


def migrate(records: list[dict], *, now: str | None = None) -> tuple[list[dict], dict]:
    canonical: list[dict] = []
    rows: list[dict] = []
    for record in records:
        question, mapper_issues = map_record(record, now=now)
        issues = sorted(set(mapper_issues + [
            "access_classification_requires_owner_confirmation",
            "scientific_review_pending",
            "editorial_review_pending",
        ]))
        canonical.append(question)
        rows.append({
            "source_path": record["source_path"],
            "source_key": record["source_key"],
            "canonical_id": question["id"],
            "issues": issues,
            "ready_for_review": True,
            "ready_for_approval": False,
        })

    report = {
        "schema_version": 1,
        "source_path": "modules/fixation-guide-v3.html",
        "source_record_count": len(records),
        "canonical_record_count": len(canonical),
        "summary": {
            "ready_for_review": sum(row["ready_for_review"] for row in rows),
            "ready_for_approval": sum(row["ready_for_approval"] for row in rows),
            "missing_distractor_rationales": sum(
                issue.startswith("missing_distractor_rationale_")
                for row in rows for issue in row["issues"]
            ),
            "access_owner_confirmations": sum(
                "access_classification_requires_owner_confirmation" in row["issues"] for row in rows
            ),
            "scientific_reviews_pending": sum(
                "scientific_review_pending" in row["issues"] for row in rows
            ),
            "editorial_reviews_pending": sum(
                "editorial_review_pending" in row["issues"] for row in rows
            ),
        },
        "records": rows,
    }
    return canonical, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--issues", type=Path, default=DEFAULT_ISSUES)
    args = parser.parse_args()

    records = json.loads(args.input.read_text(encoding="utf-8"))
    canonical, report = migrate(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.issues.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(canonical, indent=2) + "\n", encoding="utf-8")
    args.issues.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"Generated {len(canonical)} Fixation canonical draft questions; "
        f"{report['summary']['missing_distractor_rationales']} distractor rationales remain open."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
