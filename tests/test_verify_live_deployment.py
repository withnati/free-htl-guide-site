from __future__ import annotations

import unittest

from scripts.verify_live_deployment import ChangedPath, is_public_path, live_url, parse_name_status


class LiveDeploymentVerifierTests(unittest.TestCase):
    def test_public_path_filter(self) -> None:
        self.assertTrue(is_public_path("index.html"))
        self.assertTrue(is_public_path("assets/seo.js"))
        self.assertTrue(is_public_path("data/site-seo.json"))
        self.assertFalse(is_public_path("scripts/verify_live_deployment.py"))
        self.assertFalse(is_public_path("docs/LAYER_7_SEARCH_VISIBILITY.md"))
        self.assertFalse(is_public_path("package.json"))

    def test_live_url_preserves_project_prefix(self) -> None:
        base = "https://withnati.github.io/free-htl-guide-site/"
        self.assertEqual(
            live_url(base, "index.html", "abc123"),
            "https://withnati.github.io/free-htl-guide-site/?deployment=abc123",
        )
        self.assertEqual(
            live_url(base, "modules/fixation-guide-v3.html", "abc123"),
            "https://withnati.github.io/free-htl-guide-site/modules/fixation-guide-v3.html?deployment=abc123",
        )

    def test_name_status_parsing_handles_renames(self) -> None:
        parsed = parse_name_status(
            "M\tindex.html\nA\tassets/seo.js\nD\told.html\nR100\tbefore.html\tafter.html\n"
        )
        self.assertEqual(
            parsed,
            [
                ChangedPath("M", "index.html"),
                ChangedPath("A", "assets/seo.js"),
                ChangedPath("D", "old.html"),
                ChangedPath("D", "before.html"),
                ChangedPath("A", "after.html"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
