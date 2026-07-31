from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.validate_site import SITE_URL, validate_site  # noqa: E402


class SiteValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "assets").mkdir()
        (self.root / "assets" / "app.js").write_text("console.log('ok');\n", encoding="utf-8")
        (self.root / "assets" / "style.css").write_text("body{background:#fff}\n", encoding="utf-8")
        (self.root / "robots.txt").write_text(
            f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n", encoding="utf-8"
        )
        self.write_html("index.html", "Home", '<a href="about.html#bio">About</a>')
        self.write_html("about.html", "About", '<section id="bio"><h2>Bio</h2></section>')
        self.write_sitemap(["", "about.html"])

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_html(self, relative: str, title: str, body: str, robots: str = "") -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        url = SITE_URL if relative == "index.html" else f"{SITE_URL}{relative}"
        robots_tag = f'<meta name="robots" content="{robots}">' if robots else ""
        path.write_text(
            f'''<!doctype html><html lang="en"><head><title>{title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">{robots_tag}
<link rel="canonical" href="{url}"><link rel="stylesheet" href="{self.rel_prefix(relative)}assets/style.css">
</head><body><h1>{title}</h1>{body}<script src="{self.rel_prefix(relative)}assets/app.js"></script></body></html>''',
            encoding="utf-8",
        )

    @staticmethod
    def rel_prefix(relative: str) -> str:
        return "../" * (len(Path(relative).parts) - 1)

    def write_sitemap(self, relatives: list[str]) -> None:
        nodes = "".join(
            f"<url><loc>{SITE_URL}{relative}</loc><lastmod>2026-07-30</lastmod></url>"
            for relative in relatives
        )
        (self.root / "sitemap.xml").write_text(
            f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{nodes}</urlset>',
            encoding="utf-8",
        )

    def messages(self) -> list[str]:
        return [issue.message for issue in validate_site(self.root)]

    def test_valid_site_passes(self) -> None:
        self.assertEqual([], validate_site(self.root))

    def test_missing_file_is_reported(self) -> None:
        self.write_html("about.html", "About", '<img src="assets/missing.png" alt="">')
        self.assertTrue(any("Missing local target" in message for message in self.messages()))

    def test_missing_fragment_is_reported(self) -> None:
        self.write_html("index.html", "Home", '<a href="about.html#missing">About</a>')
        self.assertTrue(any("Missing fragment target" in message for message in self.messages()))

    def test_duplicate_id_is_reported(self) -> None:
        self.write_html("about.html", "About", '<div id="same"></div><div id="same"></div>')
        self.assertTrue(any("Duplicate id" in message for message in self.messages()))

    def test_indexable_page_missing_from_sitemap_is_reported(self) -> None:
        self.write_html("contact.html", "Contact", "<p>Contact</p>")
        self.assertTrue(any("missing from sitemap" in message for message in self.messages()))

    def test_noindex_page_in_sitemap_is_reported(self) -> None:
        self.write_html("private.html", "Private", "<p>Private</p>", robots="noindex,follow")
        self.write_sitemap(["", "about.html", "private.html"])
        self.assertTrue(any("Noindex page" in message for message in self.messages()))

    def test_missing_css_asset_is_reported(self) -> None:
        (self.root / "assets" / "style.css").write_text("body{background:url('missing.png')}\n", encoding="utf-8")
        self.assertTrue(any("Missing local CSS target" in message for message in self.messages()))


if __name__ == "__main__":
    unittest.main()
