#!/usr/bin/env python3
"""Validate the generated FHL public deployment and premium leakage boundary."""
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

PREVIEW_ROUTES = {
    "study-plan.html",
    "practice.html",
    "mock-exam.html",
    "targeted-practice.html",
    "modules/processing-guide-v3.html",
    "modules/embedding-guide-v3.html",
    "modules/staining-he-guide.html",
    "modules/special-stains-guide.html",
    "modules/lab-operations-guide.html",
    "modules/ihc-ish-guide.html",
}
INDEXABLE_ROUTES = {
    "index.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "faq.html",
    "privacy.html",
    "modules/fixation-guide-v3.html",
}
ALLOWED_DOWNLOADS = {
    "assets/all-fixation-downloads.zip",
    "assets/Fixation_Quick_Card.pdf",
    "assets/Pigment_Removal_OnePager.pdf",
    "assets/NBF_Prep_Worksheet.pdf",
    "assets/IHC_Validation_Checklist.pdf",
}
PROHIBITED_TOP_LEVEL = {
    ".git",
    ".github",
    "docs",
    "scripts",
    "tests",
    "browser-tests",
    "supabase",
    "node_modules",
    "test-results",
    "playwright-report",
}
PROHIBITED_FILE_PATTERNS = (
    re.compile(r"question-variants-.*\.json$"),
    re.compile(r"question-bank-extension\.json$"),
    re.compile(r"question-bank-manifest\.json$"),
    re.compile(r"mock-exam-blueprint\.json$"),
    re.compile(r"targeted-practice-config\.json$"),
)
PROHIBITED_TEXT_PATTERNS = (
    (re.compile(r"\b(?:fxv|prv|emv|hev|ssv|ihv|lov)-\d{3}\b"), "alternate question ID"),
    (re.compile(r"question-variants-"), "question-variant path"),
    (re.compile(r"question-bank-extension\.json"), "question extension manifest"),
    (re.compile(r"mock-exam-blueprint\.json"), "mock-exam blueprint path"),
    (re.compile(r"proof/processing-proof-v1\.json"), "private proof object path"),
    (re.compile(r"SUPABASE_SERVICE_ROLE_KEY"), "service-role variable"),
    (re.compile(r"sb_secret_[A-Za-z0-9_-]+"), "Supabase secret key"),
    (re.compile(r"github_pat_[A-Za-z0-9_]+"), "GitHub token"),
    (re.compile(r"postgres(?:ql)?://[^\s:'\"]+:[^\s@'\"]+@", re.IGNORECASE), "database credential URL"),
)
REFERENCE_ATTRIBUTES = {
    "a": ("href",),
    "img": ("src", "srcset"),
    "link": ("href",),
    "script": ("src",),
    "source": ("src", "srcset"),
    "video": ("src", "poster"),
}
SKIP_SCHEMES = {"data", "javascript", "mailto", "sms", "tel", "blob"}


class BuildHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.h1_count = 0
        self.canonical: str | None = None
        self.noindex = False
        self.references: list[str] = []
        self.inline_executable_scripts = 0
        self._script_type = ""
        self._script_src = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name.lower(): value or "" for name, value in attrs}
        tag = tag.lower()
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta" and attr_map.get("name", "").lower() == "robots":
            directives = {item.strip().lower() for item in attr_map.get("content", "").split(",")}
            self.noindex = "noindex" in directives
        if tag == "link" and "canonical" in attr_map.get("rel", "").lower().split():
            self.canonical = attr_map.get("href", "").strip()
        if tag == "script":
            self._script_type = attr_map.get("type", "").strip().lower()
            self._script_src = attr_map.get("src", "").strip()
            if not self._script_src and self._script_type not in {"application/ld+json", "application/json"}:
                self.inline_executable_scripts += 1
        for attribute in REFERENCE_ATTRIBUTES.get(tag, ()):
            value = attr_map.get(attribute, "").strip()
            if not value:
                continue
            if attribute == "srcset":
                self.references.extend(
                    item.strip().split()[0] for item in value.split(",") if item.strip()
                )
            else:
                self.references.append(value)
        if tag == "meta" and attr_map.get("property", "").lower() in {"og:image", "twitter:image"}:
            value = attr_map.get("content", "").strip()
            if value:
                self.references.append(value)


def read_json(path: Path, issues: list[str]) -> dict[str, object]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        issues.append(f"Missing required file: {path.name}")
    except json.JSONDecodeError as error:
        issues.append(f"Invalid JSON in {path.name}: {error}")
    return {}


def resolve_local(source: Path, value: str, output: Path, site_url: str) -> Path | None:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"):
        return None
    parsed = urlsplit(value)
    if parsed.scheme.lower() in SKIP_SCHEMES:
        return None
    if parsed.scheme in {"http", "https"}:
        if not value.startswith(site_url):
            return None
        relative = parsed.path.removeprefix(urlsplit(site_url).path)
        target = output / relative
    elif parsed.scheme:
        return None
    else:
        if parsed.path.startswith("/"):
            site_path = urlsplit(site_url).path
            if site_path != "/" and not parsed.path.startswith(site_path):
                return None
            relative = parsed.path.removeprefix(site_path)
            target = output / relative
        else:
            target = source.parent / parsed.path
    target = target.resolve()
    try:
        target.relative_to(output.resolve())
    except ValueError:
        return Path("__ESCAPED__")
    if target.is_dir():
        target = target / "index.html"
    return target


def validate_files(output: Path) -> list[str]:
    issues: list[str] = []
    for name in PROHIBITED_TOP_LEVEL:
        if (output / name).exists():
            issues.append(f"Prohibited deployment directory present: {name}")
    for path in output.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(output).as_posix()
        if any(pattern.fullmatch(path.name) for pattern in PROHIBITED_FILE_PATTERNS):
            issues.append(f"Protected question-bank file present: {relative}")
        if path.suffix.lower() in {".sql", ".py", ".map"}:
            issues.append(f"Server, test, or source-map file present in public output: {relative}")
        if path.suffix.lower() in {".pdf", ".zip"} and relative not in ALLOWED_DOWNLOADS:
            issues.append(f"Unapproved downloadable file present in public output: {relative}")
    return issues


def validate_text_leakage(output: Path) -> list[str]:
    issues: list[str] = []
    text_suffixes = {".html", ".js", ".css", ".json", ".xml", ".txt", ""}
    for path in output.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in text_suffixes:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        relative = path.relative_to(output).as_posix()
        for pattern, label in PROHIBITED_TEXT_PATTERNS:
            if pattern.search(content):
                issues.append(f"Potential {label} leaked into public output: {relative}")
        if path.suffix.lower() == ".html" and relative != "modules/fixation-guide-v3.html":
            if "data-correct=" in content or "data-expl=" in content:
                issues.append(f"Answer key or explanation metadata present outside public Fixation lesson: {relative}")
    return issues


def validate_html(output: Path, manifest: dict[str, object]) -> list[str]:
    issues: list[str] = []
    site_url = str(manifest.get("siteUrl", ""))
    if not site_url.endswith("/"):
        issues.append("build-manifest.json must contain a normalized siteUrl")
        return issues
    for path in sorted(output.rglob("*.html")):
        relative = path.relative_to(output).as_posix()
        parser = BuildHTMLParser()
        try:
            parser.feed(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError) as error:
            issues.append(f"Cannot parse {relative}: {error}")
            continue
        if parser.h1_count != 1:
            issues.append(f"{relative} must contain exactly one h1; found {parser.h1_count}")
        expected_canonical = site_url if relative == "index.html" else site_url + relative
        if parser.canonical != expected_canonical:
            issues.append(
                f"{relative} canonical mismatch: expected {expected_canonical}, found {parser.canonical}"
            )
        if relative in PREVIEW_ROUTES:
            content = path.read_text(encoding="utf-8")
            if not parser.noindex:
                issues.append(f"Premium preview route must be noindex: {relative}")
            if 'data-page="premium-preview"' not in content:
                issues.append(f"Premium source was not replaced by preview shell: {relative}")
            if "Premium learning preview" not in content:
                issues.append(f"Premium preview disclosure missing: {relative}")
        if relative.startswith("account/") or relative.startswith("premium/"):
            if not parser.noindex:
                issues.append(f"Private/account route must be noindex: {relative}")
        if parser.inline_executable_scripts:
            issues.append(f"Inline executable script is not allowed by the public CSP: {relative}")
        for reference in parser.references:
            target = resolve_local(path, reference, output, site_url)
            if target is None:
                continue
            if target == Path("__ESCAPED__"):
                issues.append(f"Reference escapes public output in {relative}: {reference}")
            elif not target.exists():
                issues.append(f"Missing public dependency referenced by {relative}: {reference}")
    return issues


def validate_sitemap(output: Path, manifest: dict[str, object]) -> list[str]:
    issues: list[str] = []
    site_url = str(manifest.get("siteUrl", ""))
    sitemap = output / "sitemap.xml"
    try:
        tree = ET.parse(sitemap)
    except FileNotFoundError:
        return ["Missing sitemap.xml"]
    except ET.ParseError as error:
        return [f"Invalid sitemap.xml: {error}"]
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    found: set[str] = set()
    for node in tree.getroot().findall("sm:url", namespace):
        loc = (node.findtext("sm:loc", default="", namespaces=namespace) or "").strip()
        route = "index.html" if loc == site_url else loc.removeprefix(site_url)
        found.add(route)
    if found != INDEXABLE_ROUTES:
        issues.append(
            f"Sitemap must contain only approved indexable routes; expected {sorted(INDEXABLE_ROUTES)}, "
            f"found {sorted(found)}"
        )
    if PREVIEW_ROUTES & found:
        issues.append("Premium preview routes must not appear in sitemap.xml")
    return issues


def validate_configuration(output: Path, manifest: dict[str, object]) -> list[str]:
    issues: list[str] = []
    headers = (output / "_headers").read_text(encoding="utf-8") if (output / "_headers").exists() else ""
    for token in (
        "Content-Security-Policy:",
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy:",
        "Permissions-Policy:",
        "X-Frame-Options: DENY",
        "/account/*",
        "/premium/*",
        "X-Robots-Tag: noindex, nofollow",
    ):
        if token not in headers:
            issues.append(f"_headers is missing required security token: {token}")
    if "Access-Control-Allow-Origin" in headers:
        issues.append("Public static headers must not grant cross-origin premium API access")
    robots = (output / "robots.txt").read_text(encoding="utf-8") if (output / "robots.txt").exists() else ""
    if f"Sitemap: {manifest.get('siteUrl', '')}sitemap.xml" not in robots:
        issues.append("robots.txt sitemap does not match the deployment site URL")
    access = read_json(output / "data/content-access.json", issues)
    if access and access.get("enforcementMode") != "server-authorized":
        issues.append("Public content-access metadata must declare server-authorized enforcement")
    if access and access.get("accountPlan", {}).get("clientMetadataIsNotAuthorization") is not True:
        issues.append("Public content-access metadata must reject client metadata as authorization")
    config = (output / "assets/supabase-config.js").read_text(encoding="utf-8") if (output / "assets/supabase-config.js").exists() else ""
    if "sb_publishable_" not in config:
        issues.append("Public Supabase configuration must contain only a publishable key")
    if "service_role" in config.lower() or "sb_secret_" in config:
        issues.append("Secret Supabase material present in public configuration")
    return issues


def validate(output: Path) -> list[str]:
    issues: list[str] = []
    manifest = read_json(output / "build-manifest.json", issues)
    if not manifest:
        return issues
    issues.extend(validate_files(output))
    issues.extend(validate_text_leakage(output))
    issues.extend(validate_html(output, manifest))
    issues.extend(validate_sitemap(output, manifest))
    issues.extend(validate_configuration(output, manifest))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("dist"))
    args = parser.parse_args()
    output = args.root.resolve()
    issues = validate(output)
    if issues:
        print("Public build validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    manifest = json.loads((output / "build-manifest.json").read_text(encoding="utf-8"))
    print(
        f"Public build validation passed: {manifest['fileCount']} allowlisted files, "
        f"{len(PREVIEW_ROUTES)} premium preview routes, no protected question bank or proof payload."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
