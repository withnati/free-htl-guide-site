#!/usr/bin/env python3
"""Validate the controlled HT/HTL mock exam blueprint and question bank."""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

RANGE_RE = re.compile(r"^(\d+)[–-](\d+)%$")
DIFFICULTIES = {"Foundational", "Application", "Troubleshooting"}
EXPECTED_DOMAINS = {"Fixation", "Processing", "Embedding/Microtomy", "Staining", "Laboratory Operations"}
FORBIDDEN_VARIANT_FIELDS = {"answer", "answers", "correct", "choices", "options", "domain", "moduleTitle", "sourcePath"}


@dataclass(order=True, frozen=True)
class Issue:
    path: str
    message: str


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def question_count(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    return len(re.findall(r"<fieldset\b[^>]*\bdata-correct=", text, re.IGNORECASE))


def validate_extension(
    root: Path,
    data: dict,
    sources: dict[str, dict],
    source_counts: dict[str, int],
) -> tuple[dict[str, int], list[Issue]]:
    issues: list[Issue] = []
    counts: Counter[str] = Counter()
    manifest_relative = str(data.get("extensionBankPath", ""))
    manifest_path = root / manifest_relative
    if not manifest_relative or not manifest_path.exists():
        return {}, [Issue("data/mock-exam-blueprint.json", "Question-variant manifest is missing")]

    try:
        manifest = load_json(manifest_path)
    except (OSError, json.JSONDecodeError) as exc:
        return {}, [Issue(manifest_relative, f"Invalid JSON: {exc}")]

    if manifest.get("schemaVersion") != 1:
        issues.append(Issue(manifest_relative, "schemaVersion must be 1"))
    if manifest.get("model") != "answer-key-free-source-variants":
        issues.append(Issue(manifest_relative, "model must be answer-key-free-source-variants"))
    if int(manifest.get("questionCount", 0)) != 80:
        issues.append(Issue(manifest_relative, "Variant questionCount must be 80"))
    parts = manifest.get("parts") or []
    if not parts or len(parts) != len(set(parts)):
        issues.append(Issue(manifest_relative, "Variant parts must be a non-empty unique list"))

    seen_ids: set[str] = set()
    seen_stems: set[str] = set()
    total = 0
    for relative in parts:
        part_path = root / str(relative)
        if not part_path.exists():
            issues.append(Issue(manifest_relative, f"Missing variant part {relative}"))
            continue
        try:
            part = load_json(part_path)
        except (OSError, json.JSONDecodeError) as exc:
            issues.append(Issue(str(relative), f"Invalid JSON: {exc}"))
            continue

        module_id = str(part.get("moduleId", ""))
        if part.get("schemaVersion") != 1:
            issues.append(Issue(str(relative), "schemaVersion must be 1"))
        if module_id not in sources:
            issues.append(Issue(str(relative), f"Unknown moduleId {module_id}"))
        variants = part.get("variants") or []
        if not isinstance(variants, list) or not variants:
            issues.append(Issue(str(relative), "variants must be a non-empty list"))
            continue

        valid_source_ids = {
            f"{module_id}-{index}" for index in range(1, source_counts.get(module_id, 0) + 1)
        }
        for index, variant in enumerate(variants, start=1):
            total += 1
            location = f"variant {index}"
            variant_id = str(variant.get("id", "")).strip()
            if not variant_id:
                issues.append(Issue(str(relative), f"{location} is missing id"))
            elif variant_id in seen_ids:
                issues.append(Issue(str(relative), f"Duplicate variant id {variant_id}"))
            else:
                seen_ids.add(variant_id)

            source_id = str(variant.get("sourceQuestionId", "")).strip()
            if source_id not in valid_source_ids:
                issues.append(Issue(str(relative), f"{location} references unknown source question {source_id}"))
            forbidden = sorted(FORBIDDEN_VARIANT_FIELDS.intersection(variant))
            if forbidden:
                issues.append(Issue(str(relative), f"{location} must not define {', '.join(forbidden)}"))
            if variant.get("difficulty") not in DIFFICULTIES:
                issues.append(Issue(str(relative), f"{location} has an invalid difficulty"))

            stem = " ".join(str(variant.get("stem", "")).split())
            explanation = " ".join(str(variant.get("explanation", "")).split())
            if not stem:
                issues.append(Issue(str(relative), f"{location} requires a stem"))
            elif stem.casefold() in seen_stems:
                issues.append(Issue(str(relative), f"Duplicate variant stem: {stem}"))
            else:
                seen_stems.add(stem.casefold())
            if not explanation:
                issues.append(Issue(str(relative), f"{location} requires an explanation"))
            if module_id in sources:
                counts[module_id] += 1

    expected_total = int(manifest.get("questionCount", 0))
    if total != expected_total:
        issues.append(Issue(manifest_relative, f"Variant parts contain {total} records, expected {expected_total}"))
    declared_counts = {key: int(value) for key, value in (manifest.get("moduleCounts") or {}).items()}
    if declared_counts != dict(counts):
        issues.append(Issue(manifest_relative, "moduleCounts must match the variant files"))
    return dict(counts), issues


def validate(root: Path) -> list[Issue]:
    root = root.resolve()
    issues: list[Issue] = []
    blueprint_path = root / "data/mock-exam-blueprint.json"
    page_path = root / "mock-exam.html"
    if not blueprint_path.exists():
        return [Issue("data/mock-exam-blueprint.json", "Missing mock exam blueprint")]
    if not page_path.exists():
        return [Issue("mock-exam.html", "Missing mock exam page")]
    try:
        data = load_json(blueprint_path)
    except (OSError, json.JSONDecodeError) as exc:
        return [Issue("data/mock-exam-blueprint.json", f"Invalid JSON: {exc}")]

    if data.get("schemaVersion") != 1:
        issues.append(Issue("data/mock-exam-blueprint.json", "schemaVersion must be 1"))
    total = int(data.get("questionCount", 0))
    if total != 50:
        issues.append(Issue("data/mock-exam-blueprint.json", "questionCount must be 50"))
    if int(data.get("practiceTimeMinutes", 0)) != 75:
        issues.append(Issue("data/mock-exam-blueprint.json", "practiceTimeMinutes must be 75"))
    if int(data.get("studyTargetPercent", 0)) != 80:
        issues.append(Issue("data/mock-exam-blueprint.json", "studyTargetPercent must be 80"))
    if int(data.get("minimumQuestionBankSize", 0)) != 150:
        issues.append(Issue("data/mock-exam-blueprint.json", "minimumQuestionBankSize must be 150"))

    sources = {item.get("id"): item for item in data.get("sourceModules", [])}
    if len(sources) != 7:
        issues.append(Issue("data/mock-exam-blueprint.json", "sourceModules must contain seven unique modules"))
    source_counts: dict[str, int] = {}
    available: dict[str, int] = {}
    for module_id, source in sources.items():
        relative = str(source.get("path", ""))
        path = root / relative
        if not path.exists():
            issues.append(Issue("data/mock-exam-blueprint.json", f"Missing source module {relative}"))
            continue
        count = question_count(path)
        source_counts[module_id] = count
        available[module_id] = count
        if count != 10:
            issues.append(Issue(relative, f"Expected 10 reviewed module questions; found {count}"))

    variant_counts, variant_issues = validate_extension(root, data, sources, source_counts)
    issues.extend(variant_issues)
    for module_id, count in variant_counts.items():
        available[module_id] = available.get(module_id, 0) + count

    count_sum = 0
    percent_sum = 0
    seen_domains: set[str] = set()
    for item in data.get("blueprint", []):
        domain = str(item.get("domain", ""))
        seen_domains.add(domain)
        count = int(item.get("count", 0))
        percent = int(item.get("percent", 0))
        count_sum += count
        percent_sum += percent
        if count * 100 != total * percent:
            issues.append(Issue("data/mock-exam-blueprint.json", f"{domain} count and percent do not agree"))
        match = RANGE_RE.match(str(item.get("officialRange", "")))
        if not match or not int(match.group(1)) <= percent <= int(match.group(2)):
            issues.append(Issue("data/mock-exam-blueprint.json", f"{domain} is outside its official range"))
        target_sum = 0
        for module_id, target in (item.get("moduleTargets") or {}).items():
            target = int(target)
            target_sum += target
            if module_id not in sources:
                issues.append(Issue("data/mock-exam-blueprint.json", f"Unknown module target {module_id}"))
            elif target > available.get(module_id, 0):
                issues.append(Issue("data/mock-exam-blueprint.json", f"Target exceeds available questions for {module_id}"))
        if target_sum != count:
            issues.append(Issue("data/mock-exam-blueprint.json", f"Module targets for {domain} must total {count}"))

    if seen_domains != EXPECTED_DOMAINS:
        issues.append(Issue("data/mock-exam-blueprint.json", "Blueprint must contain the five official content areas"))
    if count_sum != total:
        issues.append(Issue("data/mock-exam-blueprint.json", f"Blueprint counts total {count_sum}, expected {total}"))
    if percent_sum != 100:
        issues.append(Issue("data/mock-exam-blueprint.json", f"Blueprint percentages total {percent_sum}, expected 100"))
    complete_count = sum(available.values())
    if complete_count != 150:
        issues.append(Issue("data/mock-exam-blueprint.json", f"Complete reviewed bank contains {complete_count} questions, expected 150"))

    page = page_path.read_text(encoding="utf-8")
    required = [
        "assets/mock-exam.css", "assets/mock-exam-bank.js", "assets/mock-exam-bank-load.js",
        "assets/mock-exam-state.js", "assets/mock-exam-ui.js", "assets/mock-exam-results.js",
        "assets/mock-exam-controller.js", "assets/mock-exam.js"
    ]
    for value in required:
        if value not in page:
            issues.append(Issue("mock-exam.html", f"Page must load {value}"))
        if not (root / value).exists():
            issues.append(Issue(value, "Required mock exam runtime file is missing"))
    return sorted(issues)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root)
    for issue in issues:
        print(f"::error file={issue.path},line=1::{issue.message}")
    if issues:
        print(f"Mock exam validation failed with {len(issues)} issue(s).")
        return 1
    print("Mock exam integrity passed: 50-question blueprint, five domains, 150 reviewed questions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
