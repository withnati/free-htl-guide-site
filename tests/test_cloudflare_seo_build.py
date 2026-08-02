from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

SPEC = importlib.util.spec_from_file_location(
    "build_subscription_site_entry_seo", SCRIPTS / "build_subscription_site_entry.py"
)
BUILD = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(BUILD)


class CloudflareSeoBuildTests(unittest.TestCase):
    def test_generated_build_uses_deployment_origin_for_seo_and_manifest(self) -> None:
        environment = {
            "FHL_ENVIRONMENT": "staging",
            "FHL_PUBLIC_SITE_URL": "https://fhl-guide-staging.pages.dev/",
            "FHL_SUPABASE_URL": "https://oqbubeklssmlkjjtqczr.supabase.co",
            "FHL_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test_key",
        }
        with tempfile.TemporaryDirectory() as temporary, patch.dict(os.environ, environment, clear=False):
            output = Path(temporary) / "dist"
            manifest = BUILD.build(ROOT, output)

            seo = json.loads((output / "data/site-seo.json").read_text(encoding="utf-8"))
            webmanifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))

            self.assertEqual("https://fhl-guide-staging.pages.dev/", manifest["siteUrl"])
            self.assertEqual("https://fhl-guide-staging.pages.dev/", seo["site"]["url"])
            self.assertEqual("/", webmanifest["id"])
            self.assertEqual("/", webmanifest["start_url"])
            self.assertEqual("/", webmanifest["scope"])
            self.assertEqual("/assets/app-icon.svg", webmanifest["icons"][0]["src"])

            for relative in (
                "assets/seo.css",
                "assets/app-icon.svg",
                "assets/og-home.png",
                "assets/seo.js",
                "data/site-seo.json",
                "site.webmanifest",
            ):
                self.assertTrue((output / relative).is_file(), relative)

            self.assertNotIn(
                "withnati.github.io/free-htl-guide-site",
                (output / "data/site-seo.json").read_text(encoding="utf-8"),
            )
            self.assertNotIn(
                "free-htl-guide-site",
                (output / "site.webmanifest").read_text(encoding="utf-8"),
            )


if __name__ == "__main__":
    unittest.main()
