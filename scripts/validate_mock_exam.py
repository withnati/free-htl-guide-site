#!/usr/bin/env python3
"""Validate the controlled HT/HTL mock exam blueprint and runtime."""
from __future__ import annotations
import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

RANGE_RE = re.compile(r"^(\d+)[–-](\d+)%$")

@dataclass(order=True, frozen=True)
class Issue:
    path: str
    message: str

def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def question_count(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    return len(re.findall(r"<fieldset\b[^>]*\bdata-correct=", text, re.IGNORECASE))

def validate(root: Path) -> list[Issue]:
    root = root.resolve()
    issues: list[Issue] = []
    blueprint_path = root / "data/mock-exam-blueprint.json"
    page_path = root / "mock-exam.html"
    if not blueprint_path.exists(): return [Issue("data/mock-exam-blueprint.json", "Missing mock exam blueprint")]
    if not page_path.exists(): return [Issue("mock-exam.html", "Missing mock exam page")]
    try: data = load_json(blueprint_path)
    except (OSError, json.JSONDecodeError) as exc: return [Issue("data/mock-exam-blueprint.json", f"Invalid JSON: {exc}")]

    if data.get("schemaVersion") != 1: issues.append(Issue("data/mock-exam-blueprint.json", "schemaVersion must be 1"))
    total = int(data.get("questionCount", 0))
    if total != 50: issues.append(Issue("data/mock-exam-blueprint.json", "questionCount must be 50"))
    if int(data.get("practiceTimeMinutes", 0)) != 75: issues.append(Issue("data/mock-exam-blueprint.json", "practiceTimeMinutes must be 75"))
    if int(data.get("studyTargetPercent", 0)) != 80: issues.append(Issue("data/mock-exam-blueprint.json", "studyTargetPercent must be 80"))

    sources = {item.get("id"): item for item in data.get("sourceModules", [])}
    available: dict[str, int] = {}
    for module_id, source in sources.items():
        relative = str(source.get("path", ""))
        path = root / relative
        if not path.exists():
            issues.append(Issue("data/mock-exam-blueprint.json", f"Missing source module {relative}"))
            continue
        available[module_id] = question_count(path)
        if available[module_id] != 10:
            issues.append(Issue(relative, f"Expected 10 reviewed questions; found {available[module_id]}"))

    count_sum = 0
    percent_sum = 0
    expected_domains = {"Fixation", "Processing", "Embedding/Microtomy", "Staining", "Laboratory Operations"}
    seen_domains: set[str] = set()
    for item in data.get("blueprint", []):
        domain = str(item.get("domain", ""))
        seen_domains.add(domain)
        count = int(item.get("count", 0)); percent = int(item.get("percent", 0))
        count_sum += count; percent_sum += percent
        if count * 100 != total * percent:
            issues.append(Issue("data/mock-exam-blueprint.json", f"{domain} count and percent do not agree"))
        match = RANGE_RE.match(str(item.get("officialRange", "")))
        if not match or not int(match.group(1)) <= percent <= int(match.group(2)):
            issues.append(Issue("data/mock-exam-blueprint.json", f"{domain} is outside its official range"))
        target_sum = 0
        for module_id, target in (item.get("moduleTargets") or {}).items():
            target = int(target); target_sum += target
            if module_id not in sources: issues.append(Issue("data/mock-exam-blueprint.json", f"Unknown module target {module_id}"))
            elif target > available.get(module_id, 0): issues.append(Issue("data/mock-exam-blueprint.json", f"Target exceeds available questions for {module_id}"))
        if target_sum != count: issues.append(Issue("data/mock-exam-blueprint.json", f"Module targets for {domain} must total {count}"))

    if seen_domains != expected_domains: issues.append(Issue("data/mock-exam-blueprint.json", "Blueprint must contain the five official content areas"))
    if count_sum != total: issues.append(Issue("data/mock-exam-blueprint.json", f"Blueprint counts total {count_sum}, expected {total}"))
    if percent_sum != 100: issues.append(Issue("data/mock-exam-blueprint.json", f"Blueprint percentages total {percent_sum}, expected 100"))
    if sum(available.values()) < int(data.get("minimumQuestionBankSize", 0)):
        issues.append(Issue("data/mock-exam-blueprint.json", "Reviewed source bank is below its declared minimum"))

    page = page_path.read_text(encoding="utf-8")
    required = ["assets/mock-exam.css", "assets/mock-exam-bank.js", "assets/mock-exam-bank-load.js", "assets/mock-exam-state.js", "assets/mock-exam-ui.js", "assets/mock-exam-results.js", "assets/mock-exam-controller.js", "assets/mock-exam.js"]
    for value in required:
        if value not in page: issues.append(Issue("mock-exam.html", f"Page must load {value}"))
        if not (root / value).exists(): issues.append(Issue(value, "Required mock exam runtime file is missing"))
    return sorted(issues)

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path.cwd()); args = parser.parse_args()
    issues = validate(args.root)
    for issue in issues: print(f"::error file={issue.path},line=1::{issue.message}")
    if issues: print(f"Mock exam validation failed with {len(issues)} issue(s)."); return 1
    print("Mock exam integrity passed: 50 questions, five domains, 70 reviewed source questions."); return 0

if __name__ == "__main__": sys.exit(main())
