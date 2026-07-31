#!/usr/bin/env python3
"""Validate the Free HTL Guide static site without external dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urlsplit

SITE_HOST = "withnati.github.io"
SITE_PREFIX = "/free-htl-guide-site/"
SITE_URL = f"https://{SITE_HOST}{SITE_PREFIX}"
SITEMAP_URL = f"{SITE_URL}sitemap.xml"

IGNORED_DIRS = {".git", ".github", "tests", "__pycache__", "node_modules"}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
OPTIONAL_END_TAGS = {
    "li", "dt", "dd", "p", "rt", "rp", "optgroup", "option", "colgroup",
    "thead", "tbody", "tfoot", "tr", "td", "th",
}
REFERENCE_ATTRIBUTES = {
    "a": {"href"},
    "audio": {"src"},
    "form": {"action"},
    "iframe": {"src"},
    "img": {"src", "srcset"},
    "link": {"href"},
    "object": {"data"},
    "script": {"src"},
    "source": {"src", "srcset"},
    "video": {"poster", "src"},
}
SKIP_SCHEMES = {"data", "javascript", "mailto", "sms", "tel", "blob"}
CSS_URL_RE = re.compile(r"url\(\s*([\"']?)(.*?)\1\s*\)", re.IGNORECASE)
CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?\s*([\"'])(.*?)\1", re.IGNORECASE)


@dataclass(order=True, frozen=True)
class Issue:
    path: str
    line: int
    message: str


@dataclass
class Reference:
    value: str
    line: int
    attribute: str


@dataclass
class HtmlDocument:
    path: Path
    doctype_html: bool = False
    html_lang: str = ""
    title: str = ""
    h1_count: int = 0
    ids: set[str] = field(default_factory=set)
    canonical: str | None = None
    noindex: bool = False
    references: list[Reference] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    json_ld_blocks: list[tuple[int, str]] = field(default_factory=list)


class SiteHTMLParser(HTMLParser):
    def __init__(self, relative_path: str) -> None:
        super().__init__(convert_charrefs=True)
        self.relative_path = relative_path
        self.document = HtmlDocument(path=Path(relative_path))
        self.stack: list[tuple[str, int]] = []
        self.in_title = False
        self.title_parts: list[str] = []
        self.json_ld_line: int | None = None
        self.json_ld_parts: list[str] = []

    def issue(self, message: str, line: int | None = None) -> None:
        self.document.issues.append(Issue(self.relative_path, line or self.getpos()[0], message))

    def handle_decl(self, decl: str) -> None:
        if decl.strip().lower() == "doctype html":
            self.document.doctype_html = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        line = self.getpos()[0]
        attr_names = [name.lower() for name, _ in attrs]
        duplicates = sorted({name for name in attr_names if attr_names.count(name) > 1})
        if duplicates:
            self.issue(f"Duplicate attribute(s) on <{tag}>: {', '.join(duplicates)}", line)
        attr_map = {name.lower(): (value or "") for name, value in attrs}

        if tag not in VOID_TAGS and tag not in OPTIONAL_END_TAGS:
            self.stack.append((tag, line))

        if tag == "html":
            self.document.html_lang = attr_map.get("lang", "").strip()
        elif tag == "title":
            self.in_title = True
            self.title_parts = []
        elif tag == "h1":
            self.document.h1_count += 1

        element_id = attr_map.get("id", "").strip()
        if element_id:
            if element_id in self.document.ids:
                self.issue(f'Duplicate id="{element_id}"', line)
            self.document.ids.add(element_id)
        if tag == "a":
            anchor_name = attr_map.get("name", "").strip()
            if anchor_name:
                self.document.ids.add(anchor_name)

        for attribute in REFERENCE_ATTRIBUTES.get(tag, set()):
            value = attr_map.get(attribute, "").strip()
            if not value:
                continue
            if attribute == "srcset":
                for candidate in split_srcset(value):
                    self.document.references.append(Reference(candidate, line, attribute))
            else:
                self.document.references.append(Reference(value, line, attribute))

        if tag == "meta":
            robots_key = attr_map.get("name", "").strip().lower()
            if robots_key == "robots":
                directives = {part.strip().lower() for part in attr_map.get("content", "").split(",")}
                self.document.noindex = "noindex" in directives
            property_name = attr_map.get("property", "").strip().lower()
            if property_name in {"og:image", "twitter:image"}:
                content = attr_map.get("content", "").strip()
                if content:
                    self.document.references.append(Reference(content, line, "content"))

        if tag == "link" and "canonical" in {
            token.lower() for token in attr_map.get("rel", "").split()
        }:
            href = attr_map.get("href", "").strip()
            if self.document.canonical is not None:
                self.issue("Multiple canonical links", line)
            self.document.canonical = href

        if tag == "script" and attr_map.get("type", "").strip().lower() == "application/ld+json":
            self.json_ld_line = line
            self.json_ld_parts = []

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        tag = tag.lower()
        if tag not in VOID_TAGS and tag not in OPTIONAL_END_TAGS and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        line = self.getpos()[0]
        if tag == "title":
            self.in_title = False
            self.document.title = " ".join("".join(self.title_parts).split())
        if tag == "script" and self.json_ld_line is not None:
            self.document.json_ld_blocks.append((self.json_ld_line, "".join(self.json_ld_parts).strip()))
            self.json_ld_line = None
            self.json_ld_parts = []

        if tag in VOID_TAGS or tag in OPTIONAL_END_TAGS:
            return
        if not self.stack:
            self.issue(f"Unexpected closing tag </{tag}>", line)
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return

        open_tags = [name for name, _ in self.stack]
        if tag not in open_tags:
            self.issue(f"Unexpected closing tag </{tag}>", line)
            return
        while self.stack and self.stack[-1][0] != tag:
            unclosed, opened_line = self.stack.pop()
            self.issue(f"<{unclosed}> opened on line {opened_line} is not closed before </{tag}>", line)
        if self.stack:
            self.stack.pop()

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if self.json_ld_line is not None:
            self.json_ld_parts.append(data)

    def close(self) -> None:
        super().close()
        for tag, line in reversed(self.stack):
            self.issue(f"Unclosed <{tag}> tag", line)
        if not self.document.doctype_html:
            self.issue("Missing <!doctype html>", 1)
        if not self.document.html_lang:
            self.issue("<html> must include a non-empty lang attribute", 1)
        if not self.document.title:
            self.issue("Missing or empty <title>", 1)
        if self.document.h1_count != 1:
            self.issue(f"Expected exactly one <h1>; found {self.document.h1_count}", 1)
        if not self.document.canonical:
            self.issue("Missing canonical link", 1)
        for line, block in self.document.json_ld_blocks:
            if not block:
                self.issue("Empty JSON-LD block", line)
                continue
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                self.issue(f"Invalid JSON-LD: {exc.msg}", line + exc.lineno - 1)


def split_srcset(value: str) -> list[str]:
    candidates: list[str] = []
    for item in value.split(","):
        item = item.strip()
        if item:
            candidates.append(item.split()[0])
    return candidates


def included_file(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return False
    return not any(part in IGNORED_DIRS for part in relative.parts)


def relative_string(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def expected_url(relative_path: str) -> str:
    return SITE_URL if relative_path == "index.html" else f"{SITE_URL}{relative_path}"


def resolve_reference(source: Path, value: str, root: Path) -> tuple[Path | None, str | None, str | None]:
    """Return (target path, fragment, error). External references return (None, None, None)."""
    value = value.strip()
    if not value:
        return source, None, None
    if value.startswith("//"):
        return None, None, None

    parsed = urlsplit(value)
    scheme = parsed.scheme.lower()
    if scheme in SKIP_SCHEMES:
        return None, None, None
    if scheme and scheme not in {"http", "https"}:
        return None, None, None
    if scheme in {"http", "https"}:
        if parsed.hostname != SITE_HOST:
            return None, None, None
        if not parsed.path.startswith(SITE_PREFIX):
            return None, None, None
        web_path = parsed.path[len(SITE_PREFIX):]
        target = root / unquote(web_path)
    else:
        web_path = unquote(parsed.path)
        if web_path.startswith("/"):
            if not web_path.startswith(SITE_PREFIX):
                return None, None, f"Root-relative URL must begin with {SITE_PREFIX}"
            target = root / web_path[len(SITE_PREFIX):]
        elif web_path:
            target = source.parent / web_path
        else:
            target = source

    try:
        target = target.resolve()
        target.relative_to(root.resolve())
    except ValueError:
        return None, None, "Reference escapes the repository root"

    if target.is_dir():
        target = target / "index.html"
    return target, unquote(parsed.fragment) or None, None


def parse_html_files(root: Path) -> tuple[dict[Path, HtmlDocument], list[Issue]]:
    documents: dict[Path, HtmlDocument] = {}
    issues: list[Issue] = []
    for path in sorted(root.rglob("*.html")):
        if not included_file(path, root):
            continue
        relative = relative_string(path, root)
        parser = SiteHTMLParser(relative)
        try:
            parser.feed(path.read_text(encoding="utf-8"))
            parser.close()
        except (OSError, UnicodeError) as exc:
            issues.append(Issue(relative, 1, f"Cannot read HTML file: {exc}"))
            continue
        documents[path.resolve()] = parser.document
        issues.extend(parser.document.issues)
    if not documents:
        issues.append(Issue(".", 1, "No HTML files found"))
    return documents, issues


def validate_html_references(root: Path, documents: dict[Path, HtmlDocument]) -> list[Issue]:
    issues: list[Issue] = []
    for source, document in documents.items():
        for reference in document.references:
            target, fragment, resolution_error = resolve_reference(source, reference.value, root)
            if resolution_error:
                issues.append(Issue(relative_string(source, root), reference.line, f"Invalid {reference.attribute} reference {reference.value!r}: {resolution_error}"))
                continue
            if target is None:
                continue
            if not target.exists():
                issues.append(Issue(relative_string(source, root), reference.line, f"Missing local target for {reference.attribute}={reference.value!r}"))
                continue
            if fragment and target.suffix.lower() == ".html":
                target_document = documents.get(target.resolve())
                if target_document is None:
                    issues.append(Issue(relative_string(source, root), reference.line, f"Cannot validate fragment #{fragment} in {reference.value!r}"))
                elif fragment not in target_document.ids:
                    issues.append(Issue(relative_string(source, root), reference.line, f"Missing fragment target #{fragment} in {relative_string(target, root)}"))
    return issues


def validate_css_references(root: Path) -> list[Issue]:
    issues: list[Issue] = []
    for path in sorted(root.rglob("*.css")):
        if not included_file(path, root):
            continue
        relative = relative_string(path, root)
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            issues.append(Issue(relative, 1, f"Cannot read CSS file: {exc}"))
            continue
        references: list[tuple[str, int]] = []
        for pattern in (CSS_URL_RE, CSS_IMPORT_RE):
            for match in pattern.finditer(text):
                value = match.group(2).strip()
                line = text.count("\n", 0, match.start()) + 1
                references.append((value, line))
        for value, line in references:
            target, _, resolution_error = resolve_reference(path.resolve(), value, root)
            if resolution_error:
                issues.append(Issue(relative, line, f"Invalid CSS reference {value!r}: {resolution_error}"))
            elif target is not None and not target.exists():
                issues.append(Issue(relative, line, f"Missing local CSS target {value!r}"))
    return issues


def validate_sitemap(root: Path, documents: dict[Path, HtmlDocument]) -> list[Issue]:
    issues: list[Issue] = []
    sitemap = root / "sitemap.xml"
    if not sitemap.exists():
        return [Issue("sitemap.xml", 1, "Missing sitemap.xml")]
    try:
        tree = ET.parse(sitemap)
    except ET.ParseError as exc:
        return [Issue("sitemap.xml", exc.position[0], f"Invalid XML: {exc}")]

    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    entries: dict[str, str | None] = {}
    for url_node in tree.getroot().findall("sm:url", namespace):
        loc = (url_node.findtext("sm:loc", default="", namespaces=namespace) or "").strip()
        lastmod = (url_node.findtext("sm:lastmod", default="", namespaces=namespace) or "").strip() or None
        if not loc:
            issues.append(Issue("sitemap.xml", 1, "Sitemap entry is missing <loc>"))
            continue
        if loc in entries:
            issues.append(Issue("sitemap.xml", 1, f"Duplicate sitemap URL: {loc}"))
        entries[loc] = lastmod
        if not loc.startswith(SITE_URL):
            issues.append(Issue("sitemap.xml", 1, f"Sitemap URL is outside the site prefix: {loc}"))
            continue
        if lastmod is None:
            issues.append(Issue("sitemap.xml", 1, f"Missing <lastmod> for {loc}"))
        else:
            try:
                date.fromisoformat(lastmod)
            except ValueError:
                issues.append(Issue("sitemap.xml", 1, f"Invalid ISO date in <lastmod> for {loc}: {lastmod}"))
        target, _, resolution_error = resolve_reference((root / "index.html").resolve(), loc, root)
        if resolution_error or target is None or not target.exists():
            issues.append(Issue("sitemap.xml", 1, f"Sitemap URL has no local HTML file: {loc}"))
            continue
        document = documents.get(target.resolve())
        if document is None:
            issues.append(Issue("sitemap.xml", 1, f"Sitemap URL does not point to an HTML page: {loc}"))
        elif document.noindex:
            issues.append(Issue("sitemap.xml", 1, f"Noindex page must not appear in sitemap: {loc}"))
        elif document.canonical != loc:
            issues.append(Issue("sitemap.xml", 1, f"Sitemap URL does not match page canonical: {loc}"))

    for path, document in documents.items():
        relative = relative_string(path, root)
        own_url = expected_url(relative)
        canonical = document.canonical
        if canonical and not canonical.startswith(SITE_URL):
            issues.append(Issue(relative, 1, f"Canonical URL is outside the site prefix: {canonical}"))
        if document.noindex:
            if own_url in entries:
                issues.append(Issue(relative, 1, "Noindex page is included in sitemap"))
            continue
        if canonical == own_url and own_url not in entries:
            issues.append(Issue(relative, 1, "Indexable canonical page is missing from sitemap"))
    return issues


def validate_robots(root: Path) -> list[Issue]:
    path = root / "robots.txt"
    if not path.exists():
        return [Issue("robots.txt", 1, "Missing robots.txt")]
    text = path.read_text(encoding="utf-8")
    issues: list[Issue] = []
    if not re.search(r"(?im)^\s*user-agent\s*:\s*\*\s*$", text):
        issues.append(Issue("robots.txt", 1, "robots.txt must include User-agent: *"))
    if not re.search(rf"(?im)^\s*sitemap\s*:\s*{re.escape(SITEMAP_URL)}\s*$", text):
        issues.append(Issue("robots.txt", 1, f"robots.txt must reference {SITEMAP_URL}"))
    return issues


def validate_site(root: Path) -> list[Issue]:
    root = root.resolve()
    documents, issues = parse_html_files(root)
    issues.extend(validate_html_references(root, documents))
    issues.extend(validate_css_references(root))
    issues.extend(validate_sitemap(root, documents))
    issues.extend(validate_robots(root))
    return sorted(set(issues))


def emit_issues(issues: Iterable[Issue]) -> None:
    for issue in issues:
        message = issue.message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error file={issue.path},line={max(issue.line, 1)}::{message}")
        print(f"ERROR {issue.path}:{max(issue.line, 1)}: {issue.message}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args(argv)
    issues = validate_site(args.root)
    if issues:
        emit_issues(issues)
        print(f"\nSite validation failed with {len(issues)} issue(s).")
        return 1
    html_count = sum(1 for path in args.root.rglob("*.html") if included_file(path, args.root.resolve()))
    print(f"Site validation passed for {html_count} HTML page(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
