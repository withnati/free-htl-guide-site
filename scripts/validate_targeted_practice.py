#!/usr/bin/env python3
"""Validate the Layer 12 targeted-practice contract."""
from __future__ import annotations

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path

DOMAINS = ["Fixation", "Processing", "Embedding/Microtomy", "Staining", "Laboratory Operations"]
DIFFICULTIES = ["Foundational", "Application", "Troubleshooting"]
SOURCE_MODES = ["custom", "weak", "missed", "flagged"]


class PracticeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonical: str | None = None
        self.robots: str | None = None
        self.scripts: list[str] = []
        self.attrs: set[str] = set()
        self.h1_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        self.attrs.update(values)
        if tag == "h1":
            self.h1_count += 1
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href")
        if tag == "meta" and values.get("name") == "robots":
            self.robots = values.get("content")
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")


def load_json(path: Path, issues: list[str]) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        issues.append(f"Missing required file: {path}")
    except json.JSONDecodeError as error:
        issues.append(f"Invalid JSON in {path}: {error}")
    return {}


def validate_config(data: dict) -> list[str]:
    issues: list[str] = []
    if data.get("schemaVersion") != 1:
        issues.append("targeted-practice config schemaVersion must be 1")
    if data.get("practiceId") != "free-htl-targeted-practice":
        issues.append("targeted-practice practiceId is incorrect")
    if data.get("accessTier") != "premium":
        issues.append("targeted-practice config must remain premium")
    if data.get("premiumEnforcement") != "planned":
        issues.append("targeted-practice must not claim secure paywall enforcement yet")
    if data.get("questionCounts") != [10, 20, 30]:
        issues.append("targeted-practice questionCounts must be [10, 20, 30]")
    if data.get("domains") != DOMAINS:
        issues.append("targeted-practice domains must match the five controlled domains")
    if data.get("difficulties") != DIFFICULTIES:
        issues.append("targeted-practice difficulties must match the controlled vocabulary")
    mode_ids = [item.get("id") for item in data.get("modes") or []]
    if mode_ids != ["study", "exam"]:
        issues.append("targeted-practice modes must be study and exam")
    source_ids = [item.get("id") for item in data.get("sourceModes") or []]
    if source_ids != SOURCE_MODES:
        issues.append("targeted-practice source modes must be custom, weak, missed, and flagged")
    return issues


def validate_page(root: Path) -> list[str]:
    issues: list[str] = []
    path = root / "targeted-practice.html"
    if not path.is_file():
        return ["Missing targeted-practice.html"]
    page_text = path.read_text(encoding="utf-8")
    page_lower = page_text.lower()
    parser = PracticeParser()
    parser.feed(page_text)
    if parser.h1_count != 1:
        issues.append("targeted-practice.html must have exactly one h1")
    if parser.canonical != "https://withnati.github.io/free-htl-guide-site/targeted-practice.html":
        issues.append("targeted-practice canonical URL is incorrect")
    robots = (parser.robots or "").lower().replace(" ", "")
    if "noindex" not in robots:
        issues.append("targeted-practice.html must remain noindex until protected delivery exists")
    reviewed_base = "70" in page_lower and "base question" in page_lower and "review" in page_lower
    pending_scenarios = (
        "80 alternate scenarios" in page_lower
        and ("final review" in page_lower or "editorial review" in page_lower)
    )
    if not reviewed_base or not pending_scenarios:
        issues.append("targeted-practice must disclose the 70 reviewed base questions and 80 scenarios still in editorial review")
    if "same reviewed 150-question bank" in page_text or "150 reviewed records" in page_text:
        issues.append("targeted-practice must not describe all 150 development records as fully reviewed")
    expected_scripts = [
        "assets/mock-exam-bank.js",
        "assets/mock-exam-bank-dom.js",
        "assets/mock-exam-bank-modules.js",
        "assets/mock-exam-bank-load.js",
        "assets/progress-service.js",
        "assets/guide.js",
        "assets/targeted-practice-state.js",
        "assets/targeted-practice.js",
    ]
    for script in expected_scripts:
        if script not in parser.scripts:
            issues.append(f"targeted-practice.html is missing {script}")
    required_attrs = {
        "data-start-practice", "data-resume-practice", "data-pool-count",
        "data-practice-grid", "data-question-mount", "data-check-answer",
        "data-submit-practice", "data-practice-domain-results",
        "data-practice-review", "data-practice-history-body",
    }
    for attr in required_attrs - parser.attrs:
        issues.append(f"targeted-practice.html is missing {attr}")

    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    if "targeted-practice.html" in sitemap:
        issues.append("targeted-practice must stay out of sitemap.xml while noindex")
    seo = load_json(root / "data/site-seo.json", issues)
    paths = {item.get("path") for item in (seo.get("pages") or {}).values() if isinstance(item, dict)}
    if "targeted-practice.html" in paths:
        issues.append("targeted-practice must stay out of the public SEO registry while noindex")
    return issues


def validate_runtime(root: Path) -> list[str]:
    issues: list[str] = []
    required = [
        "assets/targeted-practice.css",
        "assets/targeted-practice-state.js",
        "assets/targeted-practice.js",
        "data/targeted-practice-config.json",
        "browser-tests/targeted-practice.spec.cjs",
        "docs/LAYER_12_TARGETED_PRACTICE.md",
    ]
    for relative in required:
        if not (root / relative).is_file():
            issues.append(f"Missing Layer 12 file: {relative}")
    if issues:
        return issues

    state = (root / "assets/targeted-practice-state.js").read_text(encoding="utf-8")
    for token in (
        "createAttempt", "hydrateAttempt", "weakDomains", "missedQuestionIds",
        "flaggedQuestionIds", "resolvePool", "Choose at least one exam domain",
        "Choose at least one difficulty level", "htl:targeted-state",
    ):
        if token not in state:
            issues.append(f"targeted-practice-state.js is missing token: {token}")
    controller = (root / "assets/targeted-practice.js").read_text(encoding="utf-8")
    for token in (
        "recordTargetedPracticeSession", "recordTargetedPracticeAttempt",
        "selectedDomains", "selectedDifficulties", "sourceQuestionId",
        "questionResults", "Study mode",
    ):
        if token not in controller:
            issues.append(f"targeted-practice.js is missing token: {token}")
    if "protect the lowest domain" in controller:
        issues.append("targeted-practice result guidance must say practice, not protect, the lowest domain")
    for prohibited in ("localStorage.setItem", "questionText", "correctAnswer"):
        if prohibited in state or prohibited in controller:
            issues.append(f"targeted-practice runtime must not contain prohibited token: {prohibited}")

    service = (root / "assets/progress-service.js").read_text(encoding="utf-8")
    for token in ("targetedPracticeAttempts", "recordTargetedPracticeSession", "recordTargetedPracticeAttempt", "targeted-practice-completed"):
        if token not in service:
            issues.append(f"progress-service.js is missing targeted-practice token: {token}")

    access = load_json(root / "data/content-access.json", issues)
    features = {item.get("id"): item for item in access.get("features") or []}
    feature = features.get("targeted-practice") or {}
    if feature.get("path") != "targeted-practice.html" or feature.get("accessTier") != "premium":
        issues.append("content-access targeted-practice feature must point to the premium page")
    if access.get("enforcementMode") != "metadata-only":
        issues.append("Layer 12 must not implement client-side authorization")

    workflow = (root / ".github/workflows/site-quality.yml").read_text(encoding="utf-8")
    if "scripts/validate_targeted_practice.py" not in workflow:
        issues.append("site-quality workflow must run validate_targeted_practice.py")
    return issues


def validate(root: Path) -> list[str]:
    issues: list[str] = []
    config = load_json(root / "data/targeted-practice-config.json", issues)
    if config:
        issues.extend(validate_config(config))
    issues.extend(validate_page(root))
    issues.extend(validate_runtime(root))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root.resolve())
    if issues:
        print("Targeted-practice validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print("Targeted-practice validation passed: filters, modes, progress integration, editorial status, noindex status, and premium metadata are intact.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
