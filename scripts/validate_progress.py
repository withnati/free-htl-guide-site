#!/usr/bin/env python3
"""Validate the account-ready progress and access-metadata contract."""
from __future__ import annotations

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path

MODULE_IDS = [
    "fixation-v3", "processing-v3", "embedding-v3", "he-guide",
    "special-stains", "lab-operations", "ihc-ish",
]
REQUIRED_DOMAINS = {
    "Fixation", "Processing", "Embedding/Microtomy", "Staining", "Laboratory Operations"
}


class DashboardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonical: str | None = None
        self.robots: str | None = None
        self.scripts: list[tuple[str, dict[str, str | None]]] = []
        self.attrs: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        self.attrs.update(values)
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href")
        if tag == "meta" and values.get("name") == "robots":
            self.robots = values.get("content")
        if tag == "script" and values.get("src"):
            self.scripts.append((values["src"] or "", values))


def read_json(path: Path, issues: list[str]) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        issues.append(f"Missing required file: {path}")
    except json.JSONDecodeError as error:
        issues.append(f"Invalid JSON in {path}: {error}")
    return {}


def validate_access(data: dict, root: Path) -> list[str]:
    issues: list[str] = []
    if data.get("schemaVersion") != 1:
        issues.append("content-access schemaVersion must be 1")
    if data.get("enforcementMode") != "metadata-only":
        issues.append("content-access enforcementMode must remain metadata-only until secure server enforcement exists")
    if data.get("secureEnforcementRequired") is not True:
        issues.append("content-access must require secure enforcement")
    if data.get("publicHookModuleId") != "fixation-v3":
        issues.append("Fixation must remain the declared public hook module")

    modules = data.get("modules")
    if not isinstance(modules, list):
        return issues + ["content-access modules must be a list"]
    ids = [item.get("id") for item in modules]
    if ids != MODULE_IDS:
        issues.append(f"content-access module order/IDs must be {MODULE_IDS}")
    for item in modules:
        module_id = item.get("id")
        expected_tier = "public" if module_id == "fixation-v3" else "premium"
        if item.get("accessTier") != expected_tier:
            issues.append(f"{module_id} must be marked {expected_tier}")
        path = item.get("path")
        if not path or not (root / path).is_file():
            issues.append(f"Missing module path for {module_id}: {path}")

    plan = data.get("accountPlan") or {}
    if plan.get("currentAdapter") != "local-browser":
        issues.append("current account-ready adapter must be local-browser")
    if plan.get("futureAdapter") != "authenticated-cloud":
        issues.append("future adapter must be authenticated-cloud")
    if plan.get("notesSyncDefault") != "excluded":
        issues.append("private notes must be excluded from account sync by default")
    if plan.get("paymentEntitlementSource") != "server-verified":
        issues.append("payment entitlement source must be server-verified")
    if plan.get("clientMetadataIsNotAuthorization") is not True:
        issues.append("client metadata must never be treated as authorization")
    return issues


def validate_schema(data: dict) -> list[str]:
    issues: list[str] = []
    if data.get("schemaVersion") != 1:
        issues.append("progress schemaVersion must be 1")
    if data.get("storageKey") != "free-htl-progress-v1":
        issues.append("progress storageKey must be free-htl-progress-v1")
    if set(data.get("domains") or []) != REQUIRED_DOMAINS:
        issues.append("progress domains must match the five controlled exam domains")
    excluded = set(data.get("excludedFromAccountSync") or [])
    for field in {"notes", "analyticsConsent", "theme", "emailAddress"}:
        if field not in excluded:
            issues.append(f"{field} must be excluded from account sync")
    legacy = data.get("legacyKeys") or {}
    for key in ("lastSectionPrefix", "studyTaskPrefix", "quizScorePrefix", "quizBestPrefix", "mockActive", "mockHistory"):
        if not legacy.get(key):
            issues.append(f"progress schema is missing legacy key {key}")
    return issues


def validate_dashboard(root: Path) -> list[str]:
    issues: list[str] = []
    path = root / "my-progress.html"
    if not path.is_file():
        return ["Missing my-progress.html"]
    parser = DashboardParser()
    parser.feed(path.read_text(encoding="utf-8"))
    robots = (parser.robots or "").lower().replace(" ", "")
    if "noindex" not in robots:
        issues.append("my-progress.html must be noindex")
    if parser.canonical != "https://withnati.github.io/free-htl-guide-site/my-progress.html":
        issues.append("my-progress.html canonical URL is incorrect")
    script_sources = [source for source, _ in parser.scripts]
    expected = ["assets/progress-service.js", "assets/guide.js", "assets/dashboard.js"]
    for source in expected:
        if source not in script_sources:
            issues.append(f"my-progress.html is missing {source}")
    required_attrs = {
        "data-module-progress", "data-domain-progress", "data-recent-activity",
        "data-export-progress", "data-reset-progress", "data-account-status",
    }
    for attr in required_attrs - parser.attrs:
        issues.append(f"my-progress.html is missing {attr}")

    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    if "my-progress.html" in sitemap:
        issues.append("Personal progress dashboard must not be listed in sitemap.xml")
    seo = read_json(root / "data/site-seo.json", issues)
    paths = {item.get("path") for item in (seo.get("pages") or {}).values() if isinstance(item, dict)}
    if "my-progress.html" in paths:
        issues.append("Personal progress dashboard must not be included in public SEO registry")
    return issues


def validate_runtime(root: Path) -> list[str]:
    issues: list[str] = []
    required_files = [
        "assets/progress-service.js", "assets/dashboard.js", "assets/dashboard.css",
        "assets/guide.js", "assets/mock-exam-state.js", "assets/mock-exam-controller.js",
        "docs/LAYER_11_ACCOUNT_READY_PROGRESS.md",
    ]
    for relative in required_files:
        if not (root / relative).is_file():
            issues.append(f"Missing required Layer 11 file: {relative}")
    if issues:
        return issues

    service = (root / "assets/progress-service.js").read_text(encoding="utf-8")
    for token in (
        "class LocalProgressAdapter", "async function useAdapter", "migrateLegacy",
        "recordMockExamAttempt", "exportProgress", "resetProgress",
        "selectedOptionId",
    ):
        if token not in service:
            issues.append(f"progress-service.js is missing contract token: {token}")
    for prohibited in ("questionText", "correctAnswer", "emailAddress:"):
        if prohibited in service:
            issues.append(f"progress-service.js must not store prohibited field: {prohibited}")

    guide = (root / "assets/guide.js").read_text(encoding="utf-8")
    for token in ("progress-service.js", "data-free-htl-progress", "htl:module-section", "My progress"):
        if token not in guide:
            issues.append(f"guide.js is missing progress integration token: {token}")

    state = (root / "assets/mock-exam-state.js").read_text(encoding="utf-8")
    for token in ("attemptId", "questionIds", "htl:mock-state"):
        if token not in state:
            issues.append(f"mock-exam-state.js is missing account-ready token: {token}")

    controller = (root / "assets/mock-exam-controller.js").read_text(encoding="utf-8")
    for token in ("htl:mock-completed", "questionResults", "sourceQuestionId", "domains: summary.domains"):
        if token not in controller:
            issues.append(f"mock-exam-controller.js is missing progress token: {token}")

    workflow = (root / ".github/workflows/site-quality.yml").read_text(encoding="utf-8")
    if "scripts/validate_progress.py" not in workflow:
        issues.append("site-quality workflow must run validate_progress.py")
    return issues


def validate(root: Path) -> list[str]:
    issues: list[str] = []
    access = read_json(root / "data/content-access.json", issues)
    schema = read_json(root / "data/progress-schema.json", issues)
    if access:
        issues.extend(validate_access(access, root))
    if schema:
        issues.extend(validate_schema(schema))
    issues.extend(validate_dashboard(root))
    issues.extend(validate_runtime(root))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root.resolve())
    if issues:
        print("Account-ready progress validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print("Account-ready progress validation passed: local adapter, migration, noindex dashboard, and future entitlement boundaries are intact.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
