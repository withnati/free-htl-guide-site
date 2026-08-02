#!/usr/bin/env python3
"""Extract legacy module quiz fieldsets into neutral migration records.

This extractor preserves source text and answer keys. It does not assign canonical
review status or invent distractor rationales; that is handled by the mapper and
review queue.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from typing import Any


class QuizParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.quiz_depth = 0
        self.fieldset_depth = 0
        self.in_legend = False
        self.in_label = False
        self.current: dict[str, Any] | None = None
        self.current_label_value: str | None = None
        self.text_buffer: list[str] = []
        self.records: list[dict[str, Any]] = []

    @staticmethod
    def attrs_dict(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = self.attrs_dict(attrs)
        if tag == "section" and attributes.get("id") == "quiz":
            self.quiz_depth = 1
            return
        if self.quiz_depth:
            if tag == "section":
                self.quiz_depth += 1
            if tag == "fieldset":
                self.fieldset_depth += 1
                if self.fieldset_depth == 1:
                    self.current = {
                        "correct_option_id": attributes.get("data-correct", "").strip(),
                        "rationale": attributes.get("data-expl", "").strip(),
                        "stem": "",
                        "options": [],
                    }
            elif self.fieldset_depth and tag == "legend":
                self.in_legend = True
                self.text_buffer = []
            elif self.fieldset_depth and tag == "label":
                self.in_label = True
                self.current_label_value = None
                self.text_buffer = []
            elif self.in_label and tag == "input" and attributes.get("type") == "radio":
                self.current_label_value = attributes.get("value", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if not self.quiz_depth:
            return
        if tag == "legend" and self.in_legend:
            self.in_legend = False
            if self.current is not None:
                self.current["stem"] = clean_text("".join(self.text_buffer))
            self.text_buffer = []
        elif tag == "label" and self.in_label:
            self.in_label = False
            if self.current is not None:
                self.current["options"].append({
                    "id": self.current_label_value or "",
                    "text": clean_text("".join(self.text_buffer)),
                })
            self.current_label_value = None
            self.text_buffer = []
        elif tag == "fieldset" and self.fieldset_depth:
            self.fieldset_depth -= 1
            if self.fieldset_depth == 0 and self.current is not None:
                self.records.append(self.current)
                self.current = None
        elif tag == "section":
            self.quiz_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_legend or self.in_label:
            self.text_buffer.append(data)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def strip_question_number(stem: str) -> str:
    return re.sub(r"^\s*\d+\s*[.)]\s*", "", stem).strip()


def extract_module_quiz(path: Path, *, module_id: str, domain: str, access: str = "premium") -> list[dict[str, Any]]:
    parser = QuizParser()
    parser.feed(path.read_text(encoding="utf-8"))
    records: list[dict[str, Any]] = []
    for index, item in enumerate(parser.records, start=1):
        option_ids = [option["id"] for option in item["options"]]
        correct_id = item["correct_option_id"]
        correct_index = option_ids.index(correct_id) if correct_id in option_ids else None
        records.append({
            "source_path": path.as_posix(),
            "source_key": f"{module_id}-{index}",
            "stem": strip_question_number(item["stem"]),
            "options": [option["text"] for option in item["options"]],
            "correct_index": correct_index,
            "rationale": item["rationale"],
            "domain": domain,
            "topic": "migration_review_required",
            "access": access,
            "certification_scope": "HT_HTL",
            "difficulty": "applied",
            "cognitive_level": "application",
            "lesson_refs": [module_id],
        })
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--module-id", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--access", choices=("sample", "premium"), default="premium")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records = extract_module_quiz(
        args.source,
        module_id=args.module_id,
        domain=args.domain,
        access=args.access,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(records)} question(s) from {args.source}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
