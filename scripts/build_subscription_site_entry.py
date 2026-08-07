#!/usr/bin/env python3
"""Layer 15.2 public-build entry point with subscription UX routes."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit

import build_public_site
import build_public_site_entry  # noqa: F401 - applies canonical learner-facing overrides

for route in (
    "pricing.html",
    "account/subscription.html",
    "account/payment-pending.html",
    "account/checkout-canceled.html",
    "account/subscription-confirmed.html",
):
    if route not in build_public_site.PUBLIC_SOURCE_HTML:
        build_public_site.PUBLIC_SOURCE_HTML += (route,)

if "pricing.html" not in build_public_site.PUBLIC_INDEXABLE_HTML:
    build_public_site.PUBLIC_INDEXABLE_HTML += ("pricing.html",)

_RUNTIME_FILES = {
    Path("assets/question-runtime.js"),
    Path("assets/fixation-canonical-adapter.js"),
    Path("assets/fixation-runtime-activation.js"),
    Path("assets/fixation-next-step.js"),
    Path("data/fixation-runtime-bank.json"),
}

_ANALYTICS_FILES = {
    Path("assets/analytics.js"),
    Path("assets/analytics-consent.css"),
    Path("assets/signup.js"),
    Path("assets/authority.js"),
    Path("assets/seo.js"),
    Path("data/analytics-config.json"),
}

_CLOUD_SYNC_FILES = {
    Path("assets/cloud-sync-bootstrap.js"),
    Path("assets/cloud-sync.css"),
}

_SEO_FILES = {
    Path("assets/seo.css"),
    Path("assets/app-icon.svg"),
    Path("assets/og-home.png"),
}

_EXPLICIT_PUBLIC_FILES = _RUNTIME_FILES | _ANALYTICS_FILES | _CLOUD_SYNC_FILES | _SEO_FILES
_original_dependency_closure = build_public_site.dependency_closure
_original_rewrite_html = build_public_site.rewrite_html
_original_build = build_public_site.build


def dependency_closure(root: Path) -> set[Path]:
    """Include generated-build runtime and JavaScript-loaded public dependencies."""
    return _original_dependency_closure(root) | _EXPLICIT_PUBLIC_FILES


def rewrite_html(content: str, route: str, site_url: str) -> str:
    """Activate the canonical Fixation runtime and post-quiz learner handoff."""
    content = _original_rewrite_html(content, route, site_url)
    if route != "modules/fixation-guide-v3.html":
        return content

    markers = (
        '<script src="../assets/fixation-runtime-activation.js" defer></script>',
        '<script src="../assets/fixation-next-step.js" defer></script>',
    )
    missing = [marker for marker in markers if marker not in content]
    if not missing:
        return content
    if "</body>" not in content:
        raise ValueError("Cannot activate Fixation runtime without a closing body tag")
    return content.replace("</body>", f"{' '.join(missing)}\n</body>", 1)


def build(root: Path, output: Path) -> dict[str, object]:
    """Build the public site, then emit deployment-origin SEO data and manifest."""
    manifest = _original_build(root, output)
    site_url = str(manifest["siteUrl"])

    seo_path = output / "data/site-seo.json"
    seo_data = json.loads(seo_path.read_text(encoding="utf-8"))
    seo_data["site"]["url"] = site_url
    seo_path.write_text(json.dumps(seo_data, indent=2) + "\n", encoding="utf-8")

    parsed = urlsplit(site_url)
    scope = parsed.path or "/"
    if not scope.endswith("/"):
        scope += "/"
    webmanifest = {
        "id": scope,
        "name": "Free HTL Guide",
        "short_name": "HTL Guide",
        "description": "Free practical HT and HTL study guides, quizzes, study planning, and histotechnology resources.",
        "lang": "en-US",
        "start_url": scope,
        "scope": scope,
        "display": "standalone",
        "background_color": "#f8fafc",
        "theme_color": "#0f4c81",
        "icons": [
            {
                "src": f"{scope}assets/app-icon.svg",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable",
            }
        ],
    }
    (output / "site.webmanifest").write_text(
        json.dumps(webmanifest, indent=2) + "\n", encoding="utf-8"
    )

    manifest_path = output / "build-manifest.json"
    manifest["fileCount"] = sum(1 for path in output.rglob("*") if path.is_file())
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


build_public_site.dependency_closure = dependency_closure
build_public_site.rewrite_html = rewrite_html
build_public_site.build = build

if __name__ == "__main__":
    raise SystemExit(build_public_site.main())
