#!/usr/bin/env python3
"""Build the allowlisted FHL public deployment without premium source payloads."""
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

PUBLIC_SOURCE_HTML = (
    "index.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "faq.html",
    "privacy.html",
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
    "modules/fixation-guide-v3.html",
)

PREVIEW_ROUTES = {
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
        attr_map = {name.lower(): value or "" for name, value in attrs}
        for attribute in REFERENCE_ATTRIBUTES.get(tag.lower(), ()):
            value = attr_map.get(attribute, "").strip()
            if not value:
                continue
            if attribute == "srcset":
                self.references.extend(
                    item.strip().split()[0] for item in value.split(",") if item.strip()
                )
            else:
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
    environment = os.environ.get("FHL_ENVIRONMENT", "local").strip().lower() or "local"
    site_url = normalized_site_url(os.environ.get("FHL_PUBLIC_SITE_URL", DEFAULT_SITE_URL))
    supabase_url = os.environ.get("FHL_SUPABASE_URL", DEFAULT_SUPABASE_URL).strip()
    publishable_key = os.environ.get(
        "FHL_SUPABASE_PUBLISHABLE_KEY", DEFAULT_PUBLISHABLE_KEY
    ).strip()
    if environment in {"staging", "production"}:
        missing = [
            name
            for name, value in (
                ("FHL_PUBLIC_SITE_URL", os.environ.get("FHL_PUBLIC_SITE_URL", "")),
                ("FHL_SUPABASE_URL", os.environ.get("FHL_SUPABASE_URL", "")),
                (
                    "FHL_SUPABASE_PUBLISHABLE_KEY",
                    os.environ.get("FHL_SUPABASE_PUBLISHABLE_KEY", ""),
                ),
            )
            if not value.strip()
        ]
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
        if value.startswith(DEFAULT_SITE_URL):
            candidate = Path(parsed.path.removeprefix("/free-htl-guide-site/"))
        else:
            return None
    elif parsed.scheme:
        return None
    else:
        path = parsed.path
        if not path:
            return None
        if path.startswith("/free-htl-guide-site/"):
            candidate = Path(path.removeprefix("/free-htl-guide-site/"))
        elif path.startswith("/"):
            return None
        else:
            candidate = source_relative.parent / path
    normalized = Path(os.path.normpath(candidate.as_posix()))
    if normalized.is_absolute() or ".." in normalized.parts:
        resolved = (root / normalized).resolve()
        try:
            return resolved.relative_to(root.resolve())
        except ValueError as error:
            raise ValueError(f"Public reference escapes repository root: {value}") from error
    return normalized


def dependency_closure(root: Path, source_html: tuple[str, ...]) -> set[Path]:
    pending: list[Path] = [Path(item) for item in source_html]
    required: set[Path] = set(pending)
    while pending:
        relative = pending.pop()
        source = root / relative
        if not source.is_file():
            raise FileNotFoundError(f"Required public source is missing: {relative.as_posix()}")
        suffix = source.suffix.lower()
        references: list[str] = []
        if suffix == ".html":
            parser = ReferenceParser()
            parser.feed(source.read_text(encoding="utf-8"))
            references = parser.references
        elif suffix == ".css":
            text = source.read_text(encoding="utf-8")
            references = [match.group(2).strip() for match in CSS_URL_RE.finditer(text)]
        else:
            continue

        for value in references:
            target = local_reference(relative, value, root)
            if target is None:
                continue
            if target.suffix.lower() == ".html":
                if target.as_posix() not in PUBLIC_SOURCE_HTML and target.as_posix() not in PREVIEW_ROUTES:
                    raise ValueError(
                        f"Approved public source {relative.as_posix()} links to unclassified HTML route "
                        f"{target.as_posix()}"
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


def relative_prefix(route: str) -> str:
    depth = len(Path(route).parent.parts)
    return "../" * depth


def preview_page(route: str, config: dict[str, object], site_url: str) -> str:
    prefix = relative_prefix(route)
    title = html.escape(str(config["title"]))
    eyebrow = html.escape(str(config["eyebrow"]))
    summary = html.escape(str(config["summary"]))
    features = "".join(
        f"<li>{html.escape(str(item))}</li>" for item in config.get("features", [])
    )
    proof_link = ""
    if config.get("proof"):
        proof_link = (
            f'<a class="btn" href="{prefix}premium/processing-proof.html">'
            "Open the protected-delivery proof</a>"
        )
    canonical = site_url + route
    return f'''<!doctype html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>{title} | Free HTL Guide</title>
  <meta name="description" content="Preview the {title} premium learning experience.">
  <link rel="canonical" href="{canonical}">
  <link rel="stylesheet" href="{prefix}assets/guide.css">
  <link rel="stylesheet" href="{prefix}assets/premium-preview.css">
  <meta name="theme-color" content="#0F4C81">
</head>
<body data-page="premium-preview">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="bar">
  <a class="brand" href="{prefix}index.html">Free HTL Guide</a>
  <nav class="nav" aria-label="Primary">
    <a href="{prefix}index.html#modules">Modules</a>
    <a href="{prefix}study-plan.html">Study plan</a>
    <a href="{prefix}practice.html">Practice</a>
    <a href="{prefix}my-progress.html">My progress</a>
  </nav>
  <div class="actions">
    <button id="themeBtn" class="btn" type="button" aria-label="Toggle dark mode">🌙</button>
    <button id="menuBtn" class="btn menu-btn" type="button" aria-expanded="false" aria-controls="mobileMenu">Menu</button>
    <a class="btn btn-primary" href="{prefix}account/sign-up.html">Create account</a>
  </div>
</div>
<nav id="mobileMenu" class="mobile-menu" aria-label="Mobile">
  <a href="{prefix}index.html#modules">Modules</a>
  <a href="{prefix}study-plan.html">Study plan</a>
  <a href="{prefix}practice.html">Practice</a>
  <a href="{prefix}my-progress.html">My progress</a>
  <a href="{prefix}account/sign-up.html">Create account</a>
</nav></header>
<main id="main" class="preview-shell">
  <section class="preview-hero">
    <div class="preview-copy">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p class="lead">{summary}</p>
      <div class="preview-actions">
        <a class="btn btn-primary" href="{prefix}account/sign-up.html">Create a learner account</a>
        <a class="btn" href="{prefix}modules/fixation-guide-v3.html">Study the free Fixation lesson</a>
        {proof_link}
      </div>
    </div>
    <aside class="card preview-card">
      <p class="eyebrow">Premium learning preview</p>
      <h2>What the full experience will include</h2>
      <ul class="preview-list">{features}</ul>
      <p class="small muted">Payment checkout is not active during Layer 14. Creating an account does not automatically grant premium access.</p>
    </aside>
  </section>
  <section class="card preview-security-note">
    <h2>Protected before delivery</h2>
    <p>The public page contains this preview only. Full premium lessons, question banks, explanations, answer keys, and downloads are delivered only after a server verifies both the learner session and a server-controlled entitlement.</p>
  </section>
</main>
<footer class="footer"><div class="footer-inner">
  <span>© <span data-year></span> Free HTL Guide</span>
  <span><a href="{prefix}editorial.html">Editorial standards</a> · <a href="{prefix}privacy.html">Privacy</a></span>
</div></footer>
<script src="{prefix}assets/guide.js" defer></script>
</body>
</html>
'''


def copy_safe_data(root: Path, output: Path) -> None:
    data_dir = root / "data"
    if not data_dir.is_dir():
        return
    for source in sorted(data_dir.glob("*.json")):
        if any(pattern.fullmatch(source.name) for pattern in BLOCKED_DATA_PATTERNS):
            continue
        destination = output / "data" / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.name == "content-access.json":
            payload = json.loads(source.read_text(encoding="utf-8"))
            payload["enforcementMode"] = "server-authorized"
            payload["secureEnforcementRequired"] = True
            payload.setdefault("accountPlan", {})["paymentEntitlementSource"] = "server-verified"
            payload["accountPlan"]["clientMetadataIsNotAuthorization"] = True
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
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (output / "sitemap.xml").write_text(content, encoding="utf-8")
    (output / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {site_url}sitemap.xml\n",
        encoding="utf-8",
    )


def write_headers(output: Path, environment: str, supabase_url: str) -> None:
    supabase_origin = urlsplit(supabase_url)
    connect_origin = f"{supabase_origin.scheme}://{supabase_origin.netloc}"
    global_robots = "\n  X-Robots-Tag: noindex, nofollow" if environment != "production" else ""
    content = f"""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self' {connect_origin}; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests{global_robots}

/account/*
  Cache-Control: private, no-store
  X-Robots-Tag: noindex, nofollow

/premium/*
  Cache-Control: private, no-store
  X-Robots-Tag: noindex, nofollow

/modules/processing-guide-v3.html
  X-Robots-Tag: noindex, nofollow

/modules/embedding-guide-v3.html
  X-Robots-Tag: noindex, nofollow

/modules/staining-he-guide.html
  X-Robots-Tag: noindex, nofollow

/modules/special-stains-guide.html
  X-Robots-Tag: noindex, nofollow

/modules/lab-operations-guide.html
  X-Robots-Tag: noindex, nofollow

/modules/ihc-ish-guide.html
  X-Robots-Tag: noindex, nofollow

/mock-exam.html
  X-Robots-Tag: noindex, nofollow

/targeted-practice.html
  X-Robots-Tag: noindex, nofollow

/practice.html
  X-Robots-Tag: noindex, nofollow

/study-plan.html
  X-Robots-Tag: noindex, nofollow
"""
    (output / "_headers").write_text(content, encoding="utf-8")


def build(root: Path, output: Path) -> dict[str, object]:
    environment, site_url, supabase_url, publishable_key = environment_values()
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    dependencies = dependency_closure(root, PUBLIC_SOURCE_HTML)
    dependencies.update(Path(item) for item in PUBLIC_FIXATION_DOWNLOADS)
    dependencies.add(Path("assets/premium-preview.css"))

    for relative in sorted(dependencies):
        if relative.suffix.lower() == ".html":
            continue
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
        destination.write_text(preview_page(route, config, site_url), encoding="utf-8")

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
        "fileCount": sum(1 for path in output.rglob("*") if path.is_file()),
    }
    (output / "build-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
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
