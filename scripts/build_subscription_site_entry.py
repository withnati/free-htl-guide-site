#!/usr/bin/env python3
"""Layer 15.2 public-build entry point with subscription UX routes."""
from __future__ import annotations

from pathlib import Path

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
    Path("data/fixation-runtime-bank.json"),
}
_original_dependency_closure = build_public_site.dependency_closure
_original_rewrite_html = build_public_site.rewrite_html


def dependency_closure(root: Path) -> set[Path]:
    """Include the approved public Fixation runtime projection in generated builds."""
    return _original_dependency_closure(root) | _RUNTIME_FILES


def rewrite_html(content: str, route: str, site_url: str) -> str:
    """Activate the canonical runtime only in the generated public Fixation page."""
    content = _original_rewrite_html(content, route, site_url)
    if route != "modules/fixation-guide-v3.html":
        return content
    marker = '<script src="../assets/fixation-runtime-activation.js" defer></script>'
    if marker in content:
        return content
    if "</body>" not in content:
        raise ValueError("Cannot activate Fixation runtime without a closing body tag")
    return content.replace("</body>", f"{marker}\n</body>", 1)


build_public_site.dependency_closure = dependency_closure
build_public_site.rewrite_html = rewrite_html

if __name__ == "__main__":
    raise SystemExit(build_public_site.main())
