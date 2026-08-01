#!/usr/bin/env python3
"""Validate the Layer 13 browser authentication contract."""
from __future__ import annotations

import argparse
import re
from html.parser import HTMLParser
from pathlib import Path

ACCOUNT_PAGES = {
    "account/sign-up.html": "sign-up",
    "account/sign-in.html": "sign-in",
    "account/verify-email.html": "verify-email",
    "account/forgot-password.html": "forgot-password",
    "account/reset-password.html": "reset-password",
    "account/auth-callback.html": "auth-callback",
    "account/settings.html": "settings",
}
REQUIRED_SCRIPTS = (
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8",
    "../assets/supabase-config.js",
    "../assets/auth-service.js",
    "../assets/guide.js",
    "../assets/auth-ui.js",
)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.noindex = False
        self.canonical: str | None = None
        self.h1_count = 0
        self.scripts: list[str] = []
        self.body_attrs: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "meta" and values.get("name", "").lower() == "robots":
            self.noindex = "noindex" in values.get("content", "").lower()
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonical = values.get("href")
        if tag == "h1":
            self.h1_count += 1
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if tag == "body":
            self.body_attrs = values


def read(path: Path, issues: list[str]) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        issues.append(f"Missing required file: {path}")
        return ""


def validate_config(root: Path) -> list[str]:
    issues: list[str] = []
    content = read(root / "assets/supabase-config.js", issues)
    if not content:
        return issues
    if "https://oqbubeklssmlkjjtqczr.supabase.co" not in content:
        issues.append("Supabase config must use the approved development project URL")
    if "sb_publishable_" not in content:
        issues.append("Supabase config must use a browser-safe publishable key")
    for prohibited in ("service_role", "service-role", "sb_secret_", "postgresql://", "databasePassword"):
        if prohibited.lower() in content.lower():
            issues.append(f"Supabase browser config contains prohibited secret material: {prohibited}")
    if "2.110.8" not in content:
        issues.append("Supabase browser SDK version must remain pinned")
    return issues


def validate_service(root: Path) -> list[str]:
    issues: list[str] = []
    service = read(root / "assets/auth-service.js", issues)
    ui = read(root / "assets/auth-ui.js", issues)
    if service:
        for token in (
            "persistSession: true",
            "autoRefreshToken: true",
            "detectSessionInUrl: true",
            "flowType: 'pkce'",
            "signInWithPassword",
            "resetPasswordForEmail",
            "emailRedirectTo",
            "safeNext",
            "candidate.origin !== rootUrl.origin",
            "candidate.pathname.startsWith(rootUrl.pathname)",
        ):
            if token not in service:
                issues.append(f"auth-service.js is missing required security/runtime token: {token}")
        for prohibited in ("service_role", "sb_secret_", "localStorage.setItem('password", "console.log(password"):
            if prohibited.lower() in service.lower():
                issues.append(f"auth-service.js contains prohibited token: {prohibited}")
    if ui:
        for token in (
            "data-sign-up-form",
            "data-sign-in-form",
            "data-resend-form",
            "data-forgot-form",
            "data-reset-form",
            "data-profile-form",
            "Passwords do not match.",
            "If an account exists for that email",
        ):
            if token not in ui:
                issues.append(f"auth-ui.js is missing required behavior token: {token}")
        if re.search(r"localStorage\.(?:setItem|getItem)\([^\n]*(?:password|email)", ui, re.IGNORECASE):
            issues.append("auth-ui.js must not persist passwords or email addresses in localStorage")
    return issues


def validate_pages(root: Path) -> list[str]:
    issues: list[str] = []
    for relative, page_name in ACCOUNT_PAGES.items():
        content = read(root / relative, issues)
        if not content:
            continue
        parser = PageParser()
        parser.feed(content)
        if not parser.noindex:
            issues.append(f"{relative} must be noindex")
        expected_canonical = f"https://withnati.github.io/free-htl-guide-site/{relative}"
        if parser.canonical != expected_canonical:
            issues.append(f"{relative} canonical URL must be {expected_canonical}")
        if parser.h1_count != 1:
            issues.append(f"{relative} must contain exactly one h1")
        if parser.body_attrs.get("data-auth-page") != page_name:
            issues.append(f"{relative} must declare data-auth-page={page_name}")
        if tuple(parser.scripts) != REQUIRED_SCRIPTS:
            issues.append(f"{relative} must load the pinned Supabase and auth scripts in the controlled order")

    sitemap = read(root / "sitemap.xml", issues)
    for relative in ACCOUNT_PAGES:
        if relative in sitemap:
            issues.append(f"Private account page must not appear in sitemap.xml: {relative}")
    return issues


def validate_workflow(root: Path) -> list[str]:
    issues: list[str] = []
    workflow = read(root / ".github/workflows/site-quality.yml", issues)
    if "scripts/validate_auth.py" not in workflow:
        issues.append("Site Quality workflow must run validate_auth.py")
    return issues


def validate(root: Path) -> list[str]:
    return validate_config(root) + validate_service(root) + validate_pages(root) + validate_workflow(root)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root.resolve())
    if issues:
        print("Layer 13 authentication validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print("Layer 13 authentication validation passed: pinned client, PKCE sessions, safe redirects, private account pages, and secret boundaries are intact.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
