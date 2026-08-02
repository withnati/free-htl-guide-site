#!/usr/bin/env python3
"""Layer 15.2 public-build entry point with subscription UX routes."""
from __future__ import annotations

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

if __name__ == "__main__":
    raise SystemExit(build_public_site.main())
