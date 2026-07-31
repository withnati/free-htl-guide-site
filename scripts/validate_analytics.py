#!/usr/bin/env python3
"""Validate privacy-first analytics configuration, consent, and event contracts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

REQUIRED_EVENTS = {
    "page_view",
    "scroll_depth",
    "module_open",
    "file_download",
    "outbound_click",
    "email_signup_start",
    "email_signup_success",
    "email_signup_error",
    "quiz_start",
    "quiz_complete",
    "quiz_reset",
    "study_task_toggle",
    "share",
}
REQUIRED_PROHIBITED_FIELDS = {
    "email",
    "email_address",
    "personal_name",
    "full_name",
    "personal_note",
    "note_text",
    "quiz_answer",
    "answer_text",
    "question_response",
    "response_text",
    "user_id",
    "client_id",
    "phone",
    "address",
    "patient",
}
GA_ID = re.compile(r"^G-[A-Z0-9]{6,}$", re.IGNORECASE)
ANALYTICS_HOSTS = {"www.googletagmanager.com", "googletagmanager.com", "www.google-analytics.com", "google-analytics.com"}


@dataclass(order=True, frozen=True)
class Issue:
    path: str
    line: int
    message: str


class ScriptSourceParser(HTMLParser):
    """Collect executable script sources while naturally ignoring HTML comments."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.sources: list[tuple[str, int]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return
        values = {name.lower(): value or "" for name, value in attrs}
        source = values.get("src", "").strip()
        if source:
            self.sources.append((source, self.getpos()[0]))


def load_json(path: Path, issues: list[Issue]) -> dict:
    if not path.exists():
        issues.append(Issue(path.as_posix(), 1, "Missing analytics configuration"))
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        issues.append(Issue(path.as_posix(), 1, f"Invalid analytics configuration: {exc}"))
        return {}
    if not isinstance(value, dict):
        issues.append(Issue(path.as_posix(), 1, "Analytics configuration must be a JSON object"))
        return {}
    return value


def validate_config(root: Path, data: dict, issues: list[Issue]) -> None:
    path = "data/analytics-config.json"
    if data.get("schemaVersion") != 1:
        issues.append(Issue(path, 1, "schemaVersion must be 1"))
    if not isinstance(data.get("enabled"), bool):
        issues.append(Issue(path, 1, "enabled must be a boolean"))
    if data.get("provider") != "google-analytics-4":
        issues.append(Issue(path, 1, "provider must be google-analytics-4"))
    if data.get("consentRequired") is not True:
        issues.append(Issue(path, 1, "consentRequired must remain true"))

    measurement_id = str(data.get("measurementId", "")).strip()
    if data.get("enabled") and not GA_ID.fullmatch(measurement_id):
        issues.append(Issue(path, 1, "Enabled analytics requires a valid GA4 measurementId"))
    if not data.get("enabled") and measurement_id:
        issues.append(Issue(path, 1, "Disabled analytics must not retain a measurementId"))

    consent_version = str(data.get("consentVersion", ""))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", consent_version):
        issues.append(Issue(path, 1, "consentVersion must use YYYY-MM-DD"))
    storage_key = str(data.get("storageKey", ""))
    if not storage_key.startswith("free-htl-"):
        issues.append(Issue(path, 1, "storageKey must use the free-htl- namespace"))

    privacy_url = str(data.get("privacyUrl", ""))
    if privacy_url != "privacy.html" or not (root / privacy_url).exists():
        issues.append(Issue(path, 1, "privacyUrl must point to privacy.html"))
    retention = data.get("retentionMonths")
    if retention not in {2, 14}:
        issues.append(Issue(path, 1, "retentionMonths must be 2 or 14 for a standard GA4 property"))
    if data.get("eventSchemaVersion") != 1:
        issues.append(Issue(path, 1, "eventSchemaVersion must be 1"))

    events = data.get("allowedEvents")
    if not isinstance(events, dict):
        issues.append(Issue(path, 1, "allowedEvents must be an object"))
        events = {}
    missing_events = sorted(REQUIRED_EVENTS - set(events))
    if missing_events:
        issues.append(Issue(path, 1, f"Missing required analytics events: {', '.join(missing_events)}"))
    unknown_events = sorted(set(events) - REQUIRED_EVENTS)
    if unknown_events:
        issues.append(Issue(path, 1, f"Unknown analytics events require review: {', '.join(unknown_events)}"))
    for event_name, parameters in events.items():
        if len(event_name) > 40 or not re.fullmatch(r"[a-z][a-z0-9_]*", event_name):
            issues.append(Issue(path, 1, f"Invalid GA4 event name: {event_name}"))
        if not isinstance(parameters, list) or len(parameters) != len(set(parameters)):
            issues.append(Issue(path, 1, f"Event {event_name} must have a unique parameter list"))
            continue
        for parameter in parameters:
            if len(str(parameter)) > 40 or not re.fullmatch(r"[a-z][a-z0-9_]*", str(parameter)):
                issues.append(Issue(path, 1, f"Invalid parameter name {parameter} for {event_name}"))

    prohibited = {str(item).lower() for item in data.get("prohibitedFields", [])}
    missing_prohibited = sorted(REQUIRED_PROHIBITED_FIELDS - prohibited)
    if missing_prohibited:
        issues.append(Issue(path, 1, f"Missing prohibited fields: {', '.join(missing_prohibited)}"))

    for event_name, parameters in events.items():
        for parameter in parameters if isinstance(parameters, list) else []:
            lowered = str(parameter).lower()
            if any(
                lowered == field or lowered.startswith(f"{field}_") or lowered.endswith(f"_{field}")
                for field in prohibited
            ):
                issues.append(Issue(path, 1, f"Prohibited parameter {parameter} appears in {event_name}"))


def validate_implementation(root: Path, issues: list[Issue]) -> None:
    analytics_path = root / "assets" / "analytics.js"
    consent_css = root / "assets" / "analytics-consent.css"
    if not analytics_path.exists():
        issues.append(Issue("assets/analytics.js", 1, "Missing analytics controller"))
        return
    source = analytics_path.read_text(encoding="utf-8")
    required_markers = {
        "analytics-config.json": "Analytics controller must load the controlled configuration",
        "consentRequired": "Analytics controller must enforce consent configuration",
        "data-free-htl-google-tag": "Google tag must be dynamically marked",
        "googletagmanager.com/gtag/js": "Analytics controller must use the GA4 Google tag endpoint",
        "analytics_storage": "Analytics controller must set analytics storage consent",
        "ad_personalization": "Advertising personalization must be explicitly denied",
        "allow_google_signals": "Google Signals must be disabled",
        "allow_ad_personalization_signals": "Ad personalization signals must be disabled",
        "prohibitedFields": "Event payloads must apply the prohibited-field contract",
        "safeUrl": "URLs must be sanitized before analytics transmission",
        "removeAnalyticsCookies": "Consent revocation must clear analytics cookies",
        "data-analytics-dialog": "Privacy choices dialog must be available",
        "data-analytics-banner": "Consent banner must be available when analytics is configured",
        "debugEvents": "Local analytics debug evidence must be available",
    }
    for marker, message in required_markers.items():
        if marker not in source:
            issues.append(Issue("assets/analytics.js", 1, message))
    if "const MEASUREMENT_ID" in source:
        issues.append(Issue("assets/analytics.js", 1, "Measurement ID must come from analytics-config.json"))
    if not consent_css.exists():
        issues.append(Issue("assets/analytics-consent.css", 1, "Missing consent-control stylesheet"))

    guide_path = root / "assets" / "guide.js"
    guide_source = guide_path.read_text(encoding="utf-8") if guide_path.exists() else ""
    if "analytics.js" not in guide_source or "data-free-htl-analytics" not in guide_source:
        issues.append(Issue("assets/guide.js", 1, "guide.js must load the analytics controller site-wide"))


def validate_privacy(root: Path, data: dict, issues: list[Issue]) -> None:
    privacy_path = root / "privacy.html"
    if not privacy_path.exists():
        issues.append(Issue("privacy.html", 1, "Missing privacy policy"))
        return
    privacy = privacy_path.read_text(encoding="utf-8").lower()
    required_phrases = [
        "explicit consent",
        "email addresses",
        "personal notes",
        "quiz answers",
        "privacy choices",
        "14 months",
    ]
    state_phrase = (
        "analytics is available only after explicit consent"
        if data.get("enabled") is True
        else "analytics is currently disabled"
    )
    required_phrases.append(state_phrase)

    for phrase in required_phrases:
        if phrase not in privacy:
            issues.append(Issue("privacy.html", 1, f"Privacy policy must state: {phrase}"))

    if data.get("enabled") is True and "analytics is currently disabled" in privacy:
        issues.append(Issue("privacy.html", 1, "Privacy policy says analytics is disabled while configuration enables it"))
    if data.get("enabled") is not True and "analytics is available only after explicit consent" in privacy:
        issues.append(Issue("privacy.html", 1, "Privacy policy says analytics is available while configuration disables it"))


def validate_no_static_tags(root: Path, issues: list[Issue]) -> None:
    for path in sorted(root.rglob("*.html")):
        relative = path.relative_to(root).as_posix()
        parser = ScriptSourceParser()
        try:
            parser.feed(path.read_text(encoding="utf-8"))
            parser.close()
        except (OSError, UnicodeError) as exc:
            issues.append(Issue(relative, 1, f"Could not inspect script sources: {exc}"))
            continue
        for source, line in parser.sources:
            hostname = (urlsplit(source).hostname or "").lower()
            if hostname in ANALYTICS_HOSTS:
                issues.append(Issue(relative, line, "Third-party analytics tags must not be statically embedded"))


def validate_analytics(root: Path) -> list[Issue]:
    root = root.resolve()
    issues: list[Issue] = []
    config_path = root / "data" / "analytics-config.json"
    data = load_json(config_path, issues)
    if data:
        validate_config(root, data, issues)
    validate_implementation(root, issues)
    validate_privacy(root, data, issues)
    validate_no_static_tags(root, issues)
    return sorted(set(issues))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate_analytics(args.root)
    if issues:
        for issue in issues:
            print(f"{issue.path}:{issue.line}: {issue.message}")
        print(f"Analytics validation failed with {len(issues)} issue(s).")
        return 1
    print("Analytics privacy and measurement contract passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
