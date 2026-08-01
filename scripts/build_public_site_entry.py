#!/usr/bin/env python3
"""Canonical entry point for the allowlisted FHL public build."""
from __future__ import annotations

import build_public_site

build_public_site.PREVIEW_TEMPLATE = "templates/premium-preview.tpl"

if __name__ == "__main__":
    raise SystemExit(build_public_site.main())
