#!/usr/bin/env python3
"""Build an allowlisted FHL public deployment without premium source payloads."""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_SITE_URL = "https://withnati.github.io/free-htl-guide-site/"
DEFAULT_SUPABASE_URL = "https://oqbubeklssmlkjjtqczr.supabase.co"
DEFAULT_PUBLISHABLE_KEY = "sb_publishable_u7IMzg3GZJAVr-032rbhcQ_3RbxAua4"
PREVIEW_TEMPLATE = "templates/premium-preview.html"

PUBLIC_SOURCE_HTML = (
    "index.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "faq.html",
    "privacy.html",
    "terms.html",
    "my-progress.html",
    "account/auth-callback.html",
    "account/forgot-password.html",
    "account/reset-password.html",
    "account/settings.html",
    "account/sign-in.html",
    "account/sign-up.html",
    "account/verify-email.html",
    "modules/fixation-guide-v3.html",
    "premium/processing-proof.html",
)

PUBLIC_INDEXABLE_HTML = (
    "index.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "faq.html",
    "privacy.html",
    "terms.html",
    "modules/fixation-guide-v3.html",
)

PREVIEW_ROUTES: dict[str, dict[str, object]] = {
    "study-plan.html": {
        "title": "Six-week HT/HTL study plan",
        "eyebrow": "Premium study planning",
        "summary": "A structured six-week sequence that connects lessons, quizzes, mock exams, and targeted review.",
        "features": [
            "A paced sequence across the major HT/HTL content areas",
            "Checkpoints that connect lessons with practice and progress",
            "Future account-linked continuation across devices",
        ],
    },
    "practice.html": {
        "title": "Cumulative HT/HTL practice",
        "eyebrow": "Premium mixed practice",
        "summary": "Mixed-domain practice designed to reinforce core rules and reveal topics that need another review.",
        "features": [
            "Questions across fixation, processing, microtomy, staining, and operations",
            "Detailed feedback after authorized delivery",
            "Progress that contributes to weak-domain recommendations",
        ],
    },
    "mock-exam.html": {
        "title": "50-question HT/HTL mock exam",
        "eyebrow": "Premium exam practice",
        "summary": "A timed or untimed exam-style experience with domain results, flags, review, and attempt history.",
        "features": [
            "Controlled domain weighting",
            "Missed-question explanations after submission",
            "Account-linked history and cross-device continuity",
        ],
    },
    "targeted-practice.html": {
        "title": "Targeted HT/HTL practice",
        "eyebrow": "Premium personalized practice",
        "summary": "Build focused question sets by domain, difficulty, weak area, previously missed items, or saved flags.",
        "features": [
            "Study and exam feedback modes",
            "Weak-domain, missed-question, and flagged-question review",
            "Resumable account-linked sessions",
        ],
    },
    "modules/processing-guide-v3.html": {
        "title": "Processing and Decalcification",
        "eyebrow": "Premium core lesson",
        "summary": "Learn dehydration, clearing, infiltration, processor variables, decalcification, artifacts, quality control, and safety.",
        "features": [
            "Complete lesson and troubleshooting tables",
            "Premium quiz and explanations",
            "Protected schedules, comparison tools, and downloads",
        ],
        "proof": True,
    },
    "modules/embedding-guide-v3.html": {
        "title": "Embedding and Microtomy",
        "eyebrow": "Premium core lesson",
        "summary": "Develop reliable orientation, sectioning, cryostat, artifact-recognition, quality-control, and safety skills.",
        "features": [
            "Orientation and section-quality guidance",
            "Troubleshooting and premium quiz explanations",
            "Protected reference tools and downloads",
        ],
    },
    "modules/staining-he-guide.html": {
        "title": "Routine H&E Staining",
        "eyebrow": "Premium core lesson",
        "summary": "Connect hematoxylin and eosin chemistry with differentiation, bluing, balance, artifacts, and stain quality.",
        "features": [
            "Reagent chemistry and expected morphology",
            "Systematic troubleshooting",
            "Premium quiz and protected learning resources",
        ],
    },
    "modules/special-stains-guide.html": {
        "title": "Special Stains",
        "eyebrow": "Premium core lesson",
        "summary": "Study stain targets, expected colors, control selection, chemistry, artifacts, and troubleshooting.",
        "features": [
            "Major stain families and control strategy",
            "Targeted troubleshooting and interpretation",
            "Premium quiz and protected reference materials",
        ],
    },
    "modules/lab-operations-guide.html": {
        "title": "Laboratory Operations",
        "eyebrow": "Premium core lesson",
        "summary": "Strengthen safety, quality systems, calculations, regulations, equipment, validation, and corrective-action skills.",
        "features": [
            "Safety and quality-system decision making",
            "Calculations and operational troubleshooting",
            "Premium quiz and protected tools",
        ],
    },
    "modules/ihc-ish-guide.html": {
        "title": "IHC and ISH Fundamentals",
        "eyebrow": "Premium advanced lesson",
        "summary": "Study retrieval, controls, antibodies, detection, validation, ISH, molecular preservation, and troubleshooting.",
        "features": [
            "IHC and ISH workflow principles",
            "Control selection, validation, and lot bridging",
            "Premium quiz and protected advanced resources",
        ],
    },
}

BLOCKED_DATA_PATTERNS = (
    re.compile(r"question-variants-.*\.json$"),
    re.compile(r"question-bank-extension\.json$"),
    re.compile(r"question-bank-manifest\.json$"),
    re.compile(r"mock-exam-blueprint\.json$"),
    re.compile(r"targeted-practice-config\.json$"),
)

PUBLIC_FIXATION_DOWNLOADS = {
    "assets/all-fixation-downloads.zip",
    "assets/Fixation_Quick_Card.pdf",
    "assets/Pigment_Removal_OnePager.pdf",
    "assets/NBF_Prep_Worksheet.pdf",
    "assets/IHC_Validation_Checklist.pdf",
}

REFERENCE_ATTRIBUTES = {
    "a": ("href",),
    "img": ("src", "srcset"),
    "link": ("href",),
    "script": ("src",),
    "source": ("src", "srcset"),
    "video": ("src", "poster"),
}
SKIP_SCHEMES = {"data", "javascript", "mailto", "sms", "tel", "blob"}
CSS_URL_RE = re.compile(r"url\(\s*([\"']?)(.*?)\1\s*\)", re.IGNORECASE)
CANONICAL_RE = re.compile(
    r'(<link\s+[^>]*rel=["\'][^"\']*canonical[^"\']*["\'][^>]*href=["\'])([^"\']+)(["\'])',
    re.IGNORECASE,
)


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attr_map = {name.lower(): value or "" for name, value in attrs}
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
        if tag == "meta":
            key = attr_map.get("property", "").lower() or attr_map.get("name", "").lower()
            if key in {"og:image", "twitter:image"}:
                value = attr_map.get("content", "").strip()
                if value:
                    self.references.append(value)


def normalized_site_url(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("FHL_PUBLIC_SITE_URL must not be blank")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("FHL_PUBLIC_SITE_URL must be an absolute HTTP(S) URL")
    if parsed.query or parsed.fragment:
        raise ValueError("FHL_PUBLIC_SITE_URL must not contain a query or fragment")
    return value.rstrip("/") + "/"


def environment_values() -> tuple[str, str, str, str]:
    cloudflare_url = os.environ.get("CF_PAGES_URL", "").strip()
    environment = os.environ.get("FHL_ENVIRONMENT", "").strip().lower()
    if not environment:
        environment = "preview" if cloudflare_url else "local"
    site_url = normalized_site_url(
        os.environ.get("FHL_PUBLIC_SITE_URL", "").strip()
        or cloudflare_url
        or DEFAULT_SITE_URL
    )
    supabase_url = os.environ.get("FHL_SUPABASE_URL", DEFAULT_SUPABASE_URL).strip()
    publishable_key = os.environ.get(
        "FHL_SUPABASE_PUBLISHABLE_KEY", DEFAULT_PUBLISHABLE_KEY
    ).strip()
    if environment in {"staging", "production"}:
        required = {
            "FHL_PUBLIC_SITE_URL": os.environ.get("FHL_PUBLIC_SITE_URL", ""),
            "FHL_SUPABASE_URL": os.environ.get("FHL_SUPABASE_URL", ""),
            "FHL_SUPABASE_PUBLISHABLE_KEY": os.environ.get(
                "FHL_SUPABASE_PUBLISHABLE_KEY", ""
            ),
        }
        missing = [name for name, value in required.items() if not value.strip()]
        if missing:
            raise ValueError(
                f"{environment} builds require explicit values for: {', '.join(missing)}"
            )
    if not supabase_url.startswith("https://") or ".supabase.co" not in supabase_url:
        raise ValueError("FHL_SUPABASE_URL must be an approved HTTPS Supabase project URL")
    if not publishable_key.startswith("sb_publishable_"):
        raise ValueError("FHL_SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable key")
    return environment, site_url, supabase_url.rstrip("/"), publishable_key


def copy_file(root: Path, output: Path, relative: Path) -> None:
    source = root / relative
    if not source.is_file():
        raise FileNotFoundError(f"Required public dependency is missing: {relative.as_posix()}")
    destination = output / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def local_reference(source_relative: Path, value: str, root: Path) -> Path | None:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"):
        return None
    parsed = urlsplit(value)
    if parsed.scheme.lower() in SKIP_SCHEMES:
        return None
    if parsed.scheme in {"http", "https"}:
        if not value.startswith(DEFAULT_SITE_URL):
            return None
        candidate = Path(parsed.path.removeprefix("/free-htl-guide-site/"))
    elif parsed.scheme:
        return None
    elif parsed.path.startswith("/free-htl-guide-site/"):
        candidate = Path(parsed.path.removeprefix("/free-htl-guide-site/"))
    elif parsed.path.startswith("/") or not parsed.path:
        return None
    else:
        candidate = source_relative.parent / parsed.path
    resolved = (root / candidate).resolve()
    if resolved.is_dir():
        resolved = resolved / "index.html"
    try:
        return resolved.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"Public reference escapes repository root: {value}") from error


def dependency_closure(root: Path) -> set[Path]:
    pending = [Path(item) for item in PUBLIC_SOURCE_HTML]
    required = set(pending)
    while pending:
        relative = pending.pop()
        source = root / relative
        if not source.is_file():
            raise FileNotFoundError(f"Required public source is missing: {relative.as_posix()}")
        references: list[str] = []
        if source.suffix.lower() == ".html":
            parser = ReferenceParser()
            parser.feed(source.read_text(encoding="utf-8"))
            references = parser.references
        elif source.suffix.lower() == ".css":
            text = source.read_text(encoding="utf-8")
            references = [match.group(2).strip() for match in CSS_URL_RE.finditer(text)]
        for value in references:
            target = local_reference(relative, value, root)
            if target is None:
                continue
            route = target.as_posix()
            if target.suffix.lower() == ".html":
                if route not in PUBLIC_SOURCE_HTML and route not in PREVIEW_ROUTES:
                    raise ValueError(
                        f"Approved public source {relative.as_posix()} links to unclassified HTML route {route}"
                    )
                continue
            if target not in required:
                required.add(target)
                pending.append(target)
    return required


def rewrite_html(content: str, route: str, site_url: str) -> str:
    canonical = site_url if route == "index.html" else site_url + route
    content = content.replace(DEFAULT_SITE_URL, site_url)
    if not CANONICAL_RE.search(content):
        raise ValueError(f"Cannot rewrite missing canonical in {route}")
    return CANONICAL_RE.sub(rf"\g<1>{canonical}\g<3>", content, count=1)


def preview_page(root: Path, route: str, config: dict[str, object], site_url: str) -> str:
    template = (root / PREVIEW_TEMPLATE).read_text(encoding="utf-8")
    prefix = "../" * len(Path(route).parent.parts)
    features = "".join(
        f"<li>{html.escape(str(item))}</li>" for item in config.get("features", [])
    )
    proof_link = ""
    if config.get("proof"):
        proof_link = (
            f'<a class="btn btn-primary" href="{prefix}premium/processing-proof.html" '
            'data-protected-preview-link hidden>'
            "Open secure lesson preview</a>"
        )
    replacements = {
        "{{TITLE}}": html.escape(str(config["title"])),
        "{{EYEBROW}}": html.escape(str(config["eyebrow"])),
        "{{SUMMARY}}": html.escape(str(config["summary"])),
        "{{CANONICAL}}": site_url + route,
        "{{PREFIX}}": prefix,
        "{{FEATURES}}": features,
        "{{PROOF_LINK}}": proof_link,
    }
    for token, value in replacements.items():
        template = template.replace(token, value)
    if "{{" in template or "}}" in template:
        raise ValueError(f"Unresolved premium preview template token for {route}")
    return template


def copy_safe_data(root: Path, output: Path) -> None:
    for source in sorted((root / "data").glob("*.json")):
        if any(pattern.fullmatch(source.name) for pattern in BLOCKED_DATA_PATTERNS):
            continue
        destination = output / "data" / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.name == "content-access.json":
            payload = json.loads(source.read_text(encoding="utf-8"))
            payload["enforcementMode"] = "server-authorized"
            payload["secureEnforcementRequired"] = True
            account_plan = payload.setdefault("accountPlan", {})
            account_plan["paymentEntitlementSource"] = "server-verified"
            account_plan["clientMetadataIsNotAuthorization"] = True
            destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        else:
            shutil.copy2(source, destination)


def write_supabase_config(
    output: Path, supabase_url: str, publishable_key: str, environment: str
) -> None:
    content = f"""(() => {{
  'use strict';

  window.FreeHTLSupabaseConfig = Object.freeze({{
    projectUrl: {json.dumps(supabase_url)},
    publishableKey: {json.dumps(publishable_key)},
    sdkVersion: '2.110.8',
    storageKey: {json.dumps(f'free-htl-auth-{environment}-v1')}
  }});
}})();
"""
    path = output / "assets/supabase-config.js"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_sitemap(output: Path, site_url: str) -> None:
    today = date.today().isoformat()
    entries = []
    for route in PUBLIC_INDEXABLE_HTML:
        url = site_url if route == "index.html" else site_url + route
        entries.append(f"  <url><loc>{html.escape(url)}</loc><lastmod>{today}</lastmod></url>")
    (output / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n",
        encoding="utf-8",
    )
    (output / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {site_url}sitemap.xml\n",
        encoding="utf-8",
    )


def write_headers(output: Path, environment: str, supabase_url: str) -> None:
    parsed = urlsplit(supabase_url)
    connect_origin = f"{parsed.scheme}://{parsed.netloc}"
    preview_header = "\n  X-Robots-Tag: noindex, nofollow" if environment != "production" else ""
    routes = [
        "/account/*",
        "/premium/*",
        *[f"/{route}" for route in sorted(PREVIEW_ROUTES)],
    ]
    protected_headers = "\n\n".join(
        f"{route}\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow"
        for route in routes
    )
    content = f"""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self' {connect_origin}; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests{preview_header}

{protected_headers}
"""
    (output / "_headers").write_text(content, encoding="utf-8")


def build(root: Path, output: Path) -> dict[str, object]:
    environment, site_url, supabase_url, publishable_key = environment_values()
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    dependencies = dependency_closure(root)
    dependencies.update(Path(item) for item in PUBLIC_FIXATION_DOWNLOADS)
    dependencies.add(Path("assets/premium-preview.css"))
    for relative in sorted(dependencies):
        if relative.suffix.lower() != ".html":
            copy_file(root, output, relative)

    for route in PUBLIC_SOURCE_HTML:
        source = root / route
        destination = output / route
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            rewrite_html(source.read_text(encoding="utf-8"), route, site_url),
            encoding="utf-8",
        )
    for route, config in PREVIEW_ROUTES.items():
        destination = output / route
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(preview_page(root, route, config, site_url), encoding="utf-8")

    copy_safe_data(root, output)
    write_supabase_config(output, supabase_url, publishable_key, environment)
    write_sitemap(output, site_url)
    write_headers(output, environment, supabase_url)

    manifest = {
        "schemaVersion": 1,
        "environment": environment,
        "siteUrl": site_url,
        "commit": os.environ.get("CF_PAGES_COMMIT_SHA")
        or os.environ.get("GITHUB_SHA")
        or "local",
        "publicSourcePages": list(PUBLIC_SOURCE_HTML),
        "premiumPreviewRoutes": sorted(PREVIEW_ROUTES),
        "indexableRoutes": list(PUBLIC_INDEXABLE_HTML),
        "fileCount": 0,
    }
    manifest_path = output / "build-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest["fileCount"] = sum(1 for path in output.rglob("*") if path.is_file())
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("dist"))
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    try:
        manifest = build(root, output.resolve())
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
        print(f"Public build failed: {error}")
        return 1
    print(
        f"Built {manifest['fileCount']} allowlisted public files for "
        f"{manifest['environment']} at {output.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
