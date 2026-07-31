from __future__ import annotations

import json
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.validate_seo import validate_seo


class SeoValidatorTests(unittest.TestCase):
    def make_root(self) -> Path:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / "assets").mkdir()
        (root / "data").mkdir()

        description = "A complete educational page description long enough for search and social previews."
        page_definitions = {
            "home": ("index.html", "Free HTL Guide Home", "Home"),
            "about": ("about.html", "About Free HTL Guide", "About"),
            "faq": ("faq.html", "Free HTL Guide Questions", "Frequently asked questions"),
        }
        for key, (path, title, label) in page_definitions.items():
            canonical = "https://withnati.github.io/free-htl-guide-site/" if path == "index.html" else f"https://withnati.github.io/free-htl-guide-site/{path}"
            html = (
                '<!doctype html><html lang="en"><head>'
                f'<title>{title}</title><meta name="description" content="{description}">'
                f'<link rel="canonical" href="{canonical}">'
                '</head>'
                f'<body data-page="{key}"><h1>{label}</h1><script src="assets/guide.js"></script></body></html>'
            )
            (root / path).write_text(html, encoding="utf-8")

        (root / "assets" / "guide.js").write_text("(() => {})();\n", encoding="utf-8")
        (root / "assets" / "analytics.js").write_text(
            "const seo = 'seo.js'; const marker = 'data-free-htl-seo';\n", encoding="utf-8"
        )
        (root / "assets" / "seo.js").write_text("(() => {})();\n", encoding="utf-8")
        (root / "assets" / "seo.css").write_text(".seo-share{}\n", encoding="utf-8")
        (root / "assets" / "app-icon.svg").write_text("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n", encoding="utf-8")
        png_header = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 1200, 630)
        (root / "assets" / "og-home.png").write_bytes(png_header)

        manifest = {
            "id": "/free-htl-guide-site/",
            "start_url": "/free-htl-guide-site/",
            "scope": "/free-htl-guide-site/",
            "icons": [{"src": "/free-htl-guide-site/assets/app-icon.svg", "sizes": "any", "type": "image/svg+xml"}],
        }
        (root / "site.webmanifest").write_text(json.dumps(manifest), encoding="utf-8")

        share_html = (
            '<!doctype html><html lang="en"><head><title>Share Free HTL Guide</title>'
            f'<meta name="description" content="{description}"><meta name="robots" content="noindex,follow">'
            '<link rel="canonical" href="https://withnati.github.io/free-htl-guide-site/share.html">'
            '<meta property="og:title" content="Share"><meta property="og:description" content="Share">'
            '<meta property="og:url" content="https://withnati.github.io/free-htl-guide-site/share.html">'
            '<meta property="og:image" content="https://withnati.github.io/free-htl-guide-site/assets/og-home.png">'
            '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            '<meta property="og:image:alt" content="Free HTL Guide"></head>'
            '<body data-page="share"><h1>Share</h1></body></html>'
        )
        (root / "share.html").write_text(share_html, encoding="utf-8")

        pages = {}
        keys = list(page_definitions)
        for key, (path, _, label) in page_definitions.items():
            related = [candidate for candidate in keys if candidate != key]
            pages[key] = {
                "path": path,
                "type": "website",
                "section": label,
                "share": key != "about",
                "breadcrumbs": [{"name": "Home", "path": "index.html"}]
                if key == "home"
                else [{"name": "Home", "path": "index.html"}, {"name": label, "path": path}],
                "related": related,
            }

        data = {
            "schemaVersion": 1,
            "site": {
                "name": "Free HTL Guide",
                "url": "https://withnati.github.io/free-htl-guide-site/",
                "language": "en-US",
                "updated": "2026-07-31",
                "defaultImage": "assets/og-home.png",
                "imageWidth": 1200,
                "imageHeight": 630,
                "imageAlt": "Free HTL Guide",
                "manifest": "site.webmanifest",
                "icon": "assets/app-icon.svg",
                "sharePage": "share.html",
                "author": {"name": "Natnale Mengesha", "url": "about.html"},
            },
            "pages": pages,
        }
        (root / "data" / "site-seo.json").write_text(json.dumps(data), encoding="utf-8")

        urls = []
        for _, (path, _, _) in page_definitions.items():
            loc = "https://withnati.github.io/free-htl-guide-site/" if path == "index.html" else f"https://withnati.github.io/free-htl-guide-site/{path}"
            urls.append(f"<url><loc>{loc}</loc><lastmod>2026-07-31</lastmod></url>")
        (root / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            + "".join(urls)
            + "</urlset>",
            encoding="utf-8",
        )
        return root

    def load_data(self, root: Path) -> dict:
        return json.loads((root / "data" / "site-seo.json").read_text(encoding="utf-8"))

    def save_data(self, root: Path, data: dict) -> None:
        (root / "data" / "site-seo.json").write_text(json.dumps(data), encoding="utf-8")

    def test_valid_contract_passes(self) -> None:
        self.assertEqual(validate_seo(self.make_root()), [])

    def test_missing_page_metadata_is_reported(self) -> None:
        root = self.make_root()
        data = self.load_data(root)
        del data["pages"]["faq"]
        self.save_data(root, data)
        messages = [issue.message for issue in validate_seo(root)]
        self.assertIn("Missing metadata for sitemap page keys: faq", messages)

    def test_unknown_related_page_is_reported(self) -> None:
        root = self.make_root()
        data = self.load_data(root)
        data["pages"]["home"]["related"] = ["about", "missing"]
        self.save_data(root, data)
        messages = [issue.message for issue in validate_seo(root)]
        self.assertIn("Unknown related page missing for home", messages)

    def test_wrong_social_image_size_is_reported(self) -> None:
        root = self.make_root()
        header = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 600, 315)
        (root / "assets" / "og-home.png").write_bytes(header)
        messages = [issue.message for issue in validate_seo(root)]
        self.assertIn("Social image dimensions must be 1200x630; found (600, 315)", messages)

    def test_share_bridge_in_sitemap_is_reported(self) -> None:
        root = self.make_root()
        sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
        sitemap = sitemap.replace(
            "</urlset>",
            '<url><loc>https://withnati.github.io/free-htl-guide-site/share.html</loc><lastmod>2026-07-31</lastmod></url></urlset>',
        )
        (root / "sitemap.xml").write_text(sitemap, encoding="utf-8")
        messages = [issue.message for issue in validate_seo(root)]
        self.assertIn("Share bridge must not appear in the sitemap", messages)


if __name__ == "__main__":
    unittest.main()
