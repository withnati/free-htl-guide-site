#!/usr/bin/env python3
"""Validate exact parity between the legacy Fixation quiz and canonical pilot source.

This is a shadow-mode gate. It does not publish or activate draft questions.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from extract_module_quiz import extract_module_quiz


def normalized(record: dict) -> dict:
    return {
        "source_key": record["source_key"],
        "stem": record["stem"],
        "options": record["options"],
        "correct_index": record["correct_index"],
        "rationale": record["rationale"],
    }


def compare(legacy: list[dict], pilot: list[dict]) -> list[str]:
    errors: list[str] = []
    if len(legacy) != len(pilot):
        errors.append(f"record count differs: legacy={len(legacy)} pilot={len(pilot)}")
    for index, (left, right) in enumerate(zip(legacy, pilot), start=1):
        left_view = normalized(left)
        right_view = normalized(right)
        for field in ("source_key", "stem", "options", "correct_index", "rationale"):
            if left_view[field] != right_view[field]:
                errors.append(f"question {index} {field} differs")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument(
        "--pilot",
        type=Path,
        default=Path("content/question-bank/migration/fixation-v3-neutral.json"),
    )
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    source = args.root / "modules/fixation-guide-v3.html"
    pilot_path = args.root / args.pilot
    legacy = extract_module_quiz(
        source,
        module_id="fixation-v3",
        domain="fixation",
        access="sample",
    )
    pilot = json.loads(pilot_path.read_text(encoding="utf-8"))
    errors = compare(legacy, pilot)
    report = {
        "mode": "shadow_only",
        "runtime_switched": False,
        "legacy_count": len(legacy),
        "pilot_count": len(pilot),
        "exact_parity": not errors,
        "errors": errors,
        "activation_blockers": [
            "canonical questions are still draft",
            "distractor rationales are incomplete",
            "scientific review events are missing",
            "editorial review events are missing",
            "public sample access requires owner confirmation",
        ],
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
