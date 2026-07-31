#!/usr/bin/env python3
"""Validate search, sharing, sitemap freshness, and manifest metadata."""

from __future__ import annotations

import argparse
import json
import struct
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

SITE_URL = "https://withnati.github.io/free-htl-guide-site/"
ALLOWED_PAGE_TYPES = {"website", "article", "profile"}


@dataclass(order=True, frozen=True)
class Issue:
    path: str
    line: int
    message: str


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.body_page = ""
        self.robots = ""
        self.meta_names: dict[str, str] = {}
        self.meta_properties: dict[str, str] = {}
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name.lower(): value or "" for name, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
            self.title_parts = []
        elif tag == "body":
            self.body_page = values.get("data-page", "").strip()
        elif tag == "meta":
            name = values.get("name", "").strip().lower()
            property_name = values.get("property", "").strip().lower()
            content = values.get("content", "").strip()
            if name:
                self.meta_names[name] = content
            if property_name:
                self.meta_properties[property_name] = content
            if name == "description":
                self.description = content
            if name == "robots":
                self.robots = content.lower()
        elif tag == "link":
            rel = {token.lower() for token in values.get("rel", "").split()}
            if "canonical" in rel:
                self.canonical = values.get("href", "").strip()
        elif tag == "script" and values.get("src", "").strip():
            self.scripts.append(values["src"].strip())

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False
            self.title = " ".join("".join(self.title_parts).split())

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)


def parse_html(path: Path) -> MetadataParser:
    parser = MetadataParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def expected_canonical(path: str) -> str:
    return SITE_URL if path == "index.html" else f"{SITE_URL}{path}"


def sitemap_entries(root: Path) -> tuple[dict[str, str], list[Issue]]:
    path = root / "sitemap.xml"
    if not path.exists():
        return {}, [Issue("sitemap.xml", 1, "Missing sitemap.xml")]
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        return {}, [Issue("sitemap.xml", exc.position[0], f"Invalid XML: {exc}")]
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    entries: dict[str, str] = {}
    issues: list[Issue] = []
    for node in tree.getroot().findall("sm:url", namespace):
        loc = (node.findtext("sm:loc", default="", namespaces=namespace) or "").strip()
        lastmod = (node.findtext("sm:lastmod", default="", namespaces=namespace) or "").strip()
        if not loc:
            issues.append(Issue("sitemap.xml", 1, "Sitemap entry is missing loc"))
            continue
        entries[loc] = lastmod
    return entries, issues


def local_path_from_url(url: str) -> str | None:
    if not url.startswith(SITE_URL):
        return None
    suffix = url[len(SITE_URL):]
    return suffix or "index.html"


def png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        header = path.read_bytes()[:24]
    except OSError:
        return None
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", header[16:24])


def validate_seo(root: Path) -> list[Issue]:
    root = root.resolve()
    issues: list[Issue] = []
    data_path = root / "data" / "site-seo.json"
    if not data_path.exists():
        return [Issue("data/site-seo.json", 1, "Missing SEO metadata file")]
    try:
        data = json.loads(data_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [Issue("data/site-seo.json", 1, f"Cannot read SEO metadata: {exc}")]

    site = data.get("site") or {}
    pages = data.get("pages") or {}
    if data.get("schemaVersion") != 1:
        issues.append(Issue("data/site-seo.json", 1, "schemaVersion must be 1"))
    if site.get("url") != SITE_URL:
        issues.append(Issue("data/site-seo.json", 1, f"site.url must be {SITE_URL}"))
    try:
        updated = date.fromisoformat(str(site.get("updated", "")))
        if updated > date.today():
            issues.append(Issue("data/site-seo.json", 1, "site.updated cannot be in the future"))
    except ValueError:
        issues.append(Issue("data/site-seo.json", 1, "site.updated must be an ISO date"))

    image_path = root / str(site.get("defaultImage", ""))
    if not image_path.exists():
        issues.append(Issue("data/site-seo.json", 1, "Default social image does not exist"))
    else:
        dimensions = png_dimensions(image_path)
        expected = (site.get("imageWidth"), site.get("imageHeight"))
        if dimensions != expected:
            issues.append(Issue(str(site.get("defaultImage")), 1, f"Social image dimensions must be {expected[0]}x{expected[1]}; found {dimensions}"))

    icon_path = root / str(site.get("icon", ""))
    if not icon_path.exists():
        issues.append(Issue("data/site-seo.json", 1, "App icon does not exist"))

    manifest_path = root / str(site.get("manifest", ""))
    if not manifest_path.exists():
        issues.append(Issue("data/site-seo.json", 1, "Web app manifest does not exist"))
    else:
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for key in ("id", "start_url", "scope"):
                if manifest.get(key) != "/free-htl-guide-site/":
                    issues.append(Issue(str(site.get("manifest")), 1, f"Manifest {key} must be /free-htl-guide-site/"))
            icons = manifest.get("icons") or []
            if not icons or not any(item.get("src") == "/free-htl-guide-site/assets/app-icon.svg" for item in icons):
                issues.append(Issue(str(site.get("manifest")), 1, "Manifest must reference the scalable app icon"))
        except (OSError, json.JSONDecodeError) as exc:
            issues.append(Issue(str(site.get("manifest")), 1, f"Invalid manifest JSON: {exc}"))

    entries, sitemap_issues = sitemap_entries(root)
    issues.extend(sitemap_issues)
    indexed_pages: dict[str, tuple[str, MetadataParser]] = {}
    for loc, lastmod in entries.items():
        local = local_path_from_url(loc)
        if local is None:
            issues.append(Issue("sitemap.xml", 1, f"URL is outside the canonical site: {loc}"))
            continue
        path = root / local
        if not path.exists():
            issues.append(Issue("sitemap.xml", 1, f"Sitemap page does not exist: {local}"))
            continue
        parsed = parse_html(path)
        if not parsed.body_page:
            issues.append(Issue(local, 1, "Indexable page must have body[data-page]"))
            continue
        indexed_pages[parsed.body_page] = (local, parsed)
        if lastmod != site.get("updated"):
            issues.append(Issue("sitemap.xml", 1, f"lastmod for {loc} must match site.updated ({site.get('updated')})"))

    if set(pages) != set(indexed_pages):
        missing = sorted(set(indexed_pages) - set(pages))
        extra = sorted(set(pages) - set(indexed_pages))
        if missing:
            issues.append(Issue("data/site-seo.json", 1, f"Missing metadata for sitemap page keys: {', '.join(missing)}"))
        if extra:
            issues.append(Issue("data/site-seo.json", 1, f"Metadata includes non-sitemap page keys: {', '.join(extra)}"))

    for key, page in pages.items():
        local = str(page.get("path", ""))
        path = root / local
        if not path.exists():
            issues.append(Issue("data/site-seo.json", 1, f"Page path does not exist for {key}: {local}"))
            continue
        parsed = parse_html(path)
        canonical = expected_canonical(local)
        if parsed.body_page != key:
            issues.append(Issue(local, 1, f"body data-page must be {key}"))
        if parsed.canonical != canonical:
            issues.append(Issue(local, 1, f"Canonical must be {canonical}"))
        if not 15 <= len(parsed.title) <= 70:
            issues.append(Issue(local, 1, f"Title length must be 15–70 characters; found {len(parsed.title)}"))
        if not 50 <= len(parsed.description) <= 180:
            issues.append(Issue(local, 1, f"Description length must be 50–180 characters; found {len(parsed.description)}"))
        if not any("guide.js" in src for src in parsed.scripts):
            issues.append(Issue(local, 1, "Indexable page must load assets/guide.js"))
        if parsed.meta_properties.get("og:url") and parsed.meta_properties["og:url"] != canonical:
            issues.append(Issue(local, 1, "Static og:url must match the canonical URL"))
        expected_image = f"{SITE_URL}{site.get('defaultImage', '')}"
        if parsed.meta_properties.get("og:image") and parsed.meta_properties["og:image"] != expected_image:
            issues.append(Issue(local, 1, "Static og:image must use the controlled social image"))
        if page.get("type") not in ALLOWED_PAGE_TYPES:
            issues.append(Issue("data/site-seo.json", 1, f"Invalid page type for {key}"))
        if not isinstance(page.get("share"), bool):
            issues.append(Issue("data/site-seo.json", 1, f"share must be boolean for {key}"))
        if not str(page.get("section", "")).strip():
            issues.append(Issue("data/site-seo.json", 1, f"section is required for {key}"))

        breadcrumbs = page.get("breadcrumbs") or []
        if not 1 <= len(breadcrumbs) <= 4:
            issues.append(Issue("data/site-seo.json", 1, f"breadcrumbs must contain 1–4 entries for {key}"))
        else:
            if breadcrumbs[0].get("path") != "index.html":
                issues.append(Issue("data/site-seo.json", 1, f"First breadcrumb must be Home for {key}"))
            last_path = str(breadcrumbs[-1].get("path", "")).split("#", 1)[0]
            if last_path != local:
                issues.append(Issue("data/site-seo.json", 1, f"Last breadcrumb must point to {local} for {key}"))
            for crumb in breadcrumbs:
                if not str(crumb.get("name", "")).strip() or not str(crumb.get("path", "")).strip():
                    issues.append(Issue("data/site-seo.json", 1, f"Breadcrumbs require name and path for {key}"))

        related = page.get("related") or []
        if not 2 <= len(related) <= 4:
            issues.append(Issue("data/site-seo.json", 1, f"related must contain 2–4 page keys for {key}"))
        if len(related) != len(set(related)):
            issues.append(Issue("data/site-seo.json", 1, f"related contains duplicates for {key}"))
        if key in related:
            issues.append(Issue("data/site-seo.json", 1, f"related cannot include the page itself for {key}"))
        for related_key in related:
            if related_key not in pages:
                issues.append(Issue("data/site-seo.json", 1, f"Unknown related page {related_key} for {key}"))

    analytics_path = root / "assets" / "analytics.js"
    analytics = analytics_path.read_text(encoding="utf-8") if analytics_path.exists() else ""
    if "seo.js" not in analytics or "data-free-htl-seo" not in analytics:
        issues.append(Issue("assets/analytics.js", 1, "Shared loader must load seo.js with a unique data attribute"))
    for required in ("assets/seo.js", "assets/seo.css", "share.html"):
        if not (root / required).exists():
            issues.append(Issue(required, 1, f"Missing required Layer 7 file: {required}"))

    share_path = root / "share.html"
    if share_path.exists():
        share = parse_html(share_path)
        required_share_meta = {
            "og:title", "og:description", "og:url", "og:image", "og:image:width", "og:image:height", "og:image:alt"
        }
        missing_meta = sorted(required_share_meta - set(share.meta_properties))
        if missing_meta:
            issues.append(Issue("share.html", 1, f"Share bridge is missing static metadata: {', '.join(missing_meta)}"))
        if "noindex" not in share.robots:
            issues.append(Issue("share.html", 1, "Share bridge must be noindex"))
        if expected_canonical("share.html") in entries:
            issues.append(Issue("sitemap.xml", 1, "Share bridge must not appear in the sitemap"))

    return sorted(set(issues))


def emit_issues(issues: list[Issue]) -> None:
    for issue in issues:
        message = issue.message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error file={issue.path},line={max(issue.line, 1)}::{message}")
        print(f"ERROR {issue.path}:{max(issue.line, 1)}: {issue.message}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args(argv)
    issues = validate_seo(args.root)
    if issues:
        emit_issues(issues)
        print(f"\nSEO validation failed with {len(issues)} issue(s).")
        return 1
    data = json.loads((args.root / "data" / "site-seo.json").read_text(encoding="utf-8"))
    print(f"SEO validation passed for {len(data['pages'])} canonical page(s), the social preview, and the web manifest.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
