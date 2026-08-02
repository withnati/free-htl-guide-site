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
    "terms.html",
    "pricing.html",
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
    ".git", ".github", "docs", "scripts", "templates", "tests", "browser-tests",
    "supabase", "node_modules", "test-results", "playwright-report",
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
    "a": ("href",), "img": ("src", "srcset"), "link": ("href",),
    "script": ("src",), "source": ("src", "srcset"), "video": ("src", "poster"),
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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = {name.lower(): value or "" for name, value in attrs}
        if tag == "h1": self.h1_count += 1
        if tag == "meta" and values.get("name", "").lower() == "robots":
            directives = {item.strip().lower() for item in values.get("content", "").split(",")}
            self.noindex = "noindex" in directives
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonical = values.get("href", "").strip()
        if tag == "script":
            script_type = values.get("type", "").strip().lower()
            script_src = values.get("src", "").strip()
            if not script_src and script_type not in {"application/ld+json", "application/json"}:
                self.inline_executable_scripts += 1
        for attribute in REFERENCE_ATTRIBUTES.get(tag, ()):
            value = values.get(attribute, "").strip()
            if not value: continue
            if attribute == "srcset":
                self.references.extend(item.strip().split()[0] for item in value.split(",") if item.strip())
            else: self.references.append(value)
        if tag == "meta":
            key = values.get("property", "").lower() or values.get("name", "").lower()
            if key in {"og:image", "twitter:image"}:
                value = values.get("content", "").strip()
                if value: self.references.append(value)


def read_json(path: Path, issues: list[str]) -> dict[str, object]:
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError: issues.append(f"Missing required file: {path.name}")
    except json.JSONDecodeError as error: issues.append(f"Invalid JSON in {path.name}: {error}")
    return {}


def resolve_local(source: Path, value: str, output: Path, site_url: str) -> Path | None:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"): return None
    parsed = urlsplit(value)
    if parsed.scheme.lower() in SKIP_SCHEMES: return None
    if parsed.scheme in {"http", "https"}:
        if not value.startswith(site_url): return None
        relative = parsed.path.removeprefix(urlsplit(site_url).path); target = output / relative
    elif parsed.scheme: return None
    elif parsed.path.startswith("/"):
        site_path = urlsplit(site_url).path
        if site_path != "/" and not parsed.path.startswith(site_path): return None
        target = output / parsed.path.removeprefix(site_path)
    else: target = source.parent / parsed.path
    target = target.resolve()
    try: target.relative_to(output.resolve())
    except ValueError: return Path("__ESCAPED__")
    return target / "index.html" if target.is_dir() else target


def validate_manifest(manifest: dict[str, object]) -> list[str]:
    issues: list[str] = []
    preview = set(manifest.get("premiumPreviewRoutes") or [])
    indexable = set(manifest.get("indexableRoutes") or [])
    if preview != PREVIEW_ROUTES: issues.append(f"Build manifest premium previews differ from the security allowlist: {sorted(preview)}")
    if indexable != INDEXABLE_ROUTES: issues.append(f"Build manifest indexable routes differ from the public allowlist: {sorted(indexable)}")
    if not str(manifest.get("siteUrl", "")).endswith("/"): issues.append("build-manifest.json must contain a normalized siteUrl")
    if not isinstance(manifest.get("fileCount"), int) or int(manifest.get("fileCount", 0)) < 1: issues.append("build-manifest.json must contain a positive fileCount")
    return issues


def validate_files(output: Path) -> list[str]:
    issues: list[str] = []
    for name in PROHIBITED_TOP_LEVEL:
        if (output / name).exists(): issues.append(f"Prohibited deployment directory present: {name}")
    for path in output.rglob("*"):
        if not path.is_file(): continue
        relative = path.relative_to(output).as_posix()
        if any(pattern.fullmatch(path.name) for pattern in PROHIBITED_FILE_PATTERNS): issues.append(f"Protected question-bank file present: {relative}")
        if path.suffix.lower() in {".sql", ".py", ".map"}: issues.append(f"Server, test, or source-map file present in public output: {relative}")
        if path.suffix.lower() in {".pdf", ".zip"} and relative not in ALLOWED_DOWNLOADS: issues.append(f"Unapproved downloadable file present in public output: {relative}")
    return issues


def validate_text_leakage(output: Path) -> list[str]:
    issues: list[str] = []
    text_suffixes = {".html", ".js", ".css", ".json", ".xml", ".txt", ""}
    for path in output.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in text_suffixes: continue
        try: content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError): continue
        relative = path.relative_to(output).as_posix()
        for pattern, label in PROHIBITED_TEXT_PATTERNS:
            if pattern.search(content): issues.append(f"Potential {label} leaked into public output: {relative}")
        if path.suffix.lower() == ".html" and relative != "modules/fixation-guide-v3.html":
            if "data-correct=" in content or "data-expl=" in content: issues.append(f"Quiz answer data present outside the free Fixation lesson: {relative}")
    return issues


def validate_html(output: Path, site_url: str) -> list[str]:
    issues: list[str] = []
    for path in output.rglob("*.html"):
        parser = BuildHTMLParser(); parser.feed(path.read_text(encoding="utf-8"))
        relative = path.relative_to(output).as_posix()
        if parser.h1_count != 1: issues.append(f"Expected exactly one h1 in {relative}; found {parser.h1_count}")
        if relative in INDEXABLE_ROUTES:
            expected = f"{site_url}{relative}" if relative != "index.html" else site_url
            if parser.canonical != expected: issues.append(f"Unexpected canonical for {relative}: {parser.canonical!r}")
            if parser.noindex: issues.append(f"Indexable page is marked noindex: {relative}")
        elif not parser.noindex and relative.startswith("account/"):
            issues.append(f"Account page must be noindex: {relative}")
        if parser.inline_executable_scripts: issues.append(f"Inline executable script present in {relative}")
        for reference in parser.references:
            target = resolve_local(path, reference, output, site_url)
            if target == Path("__ESCAPED__"): issues.append(f"Reference escapes output root in {relative}: {reference}")
            elif target is not None and not target.exists(): issues.append(f"Broken local reference in {relative}: {reference}")
    return issues


def validate_sitemap(output: Path, site_url: str) -> list[str]:
    issues: list[str] = []; sitemap = output / "sitemap.xml"
    try: root = ET.parse(sitemap).getroot()
    except (FileNotFoundError, ET.ParseError) as error: return [f"Invalid or missing sitemap.xml: {error}"]
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = {node.text or "" for node in root.findall("s:url/s:loc", namespace)}
    expected = {site_url if route == "index.html" else f"{site_url}{route}" for route in INDEXABLE_ROUTES}
    if urls != expected: issues.append(f"Sitemap routes differ from the public allowlist: {sorted(urls)}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", default="dist"); args = parser.parse_args()
    output = Path(args.root).resolve(); issues: list[str] = []
    manifest = read_json(output / "build-manifest.json", issues); site_url = str(manifest.get("siteUrl") or "")
    if manifest: issues.extend(validate_manifest(manifest))
    issues.extend(validate_files(output)); issues.extend(validate_text_leakage(output))
    if site_url: issues.extend(validate_html(output, site_url)); issues.extend(validate_sitemap(output, site_url))
    if issues:
        print("Public build validation failed:")
        for issue in issues: print(f"- {issue}")
        return 1
    print("Public build validation passed."); return 0


if __name__ == "__main__": raise SystemExit(main())
