#!/usr/bin/env python3
"""Verify that changed public files from a main-branch commit are live on GitHub Pages."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

DEFAULT_BASE_URL = "https://withnati.github.io/free-htl-guide-site/"
PUBLIC_EXTENSIONS = {
    ".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf",
}
EXCLUDED_PREFIXES = (
    ".git/", ".github/", "browser-tests/", "docs/", "scripts/", "tests/", "node_modules/",
)
ALWAYS_CHECK = {"index.html", "sitemap.xml", "robots.txt"}


@dataclass(frozen=True)
class ChangedPath:
    status: str
    path: str


def is_public_path(path: str) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    if not normalized or normalized.startswith(EXCLUDED_PREFIXES):
        return False
    return Path(normalized).suffix.lower() in PUBLIC_EXTENSIONS


def live_url(base_url: str, path: str, cache_key: str | None = None) -> str:
    base = base_url.rstrip("/") + "/"
    normalized = path.replace("\\", "/").lstrip("/")
    url = base if normalized == "index.html" else urllib.parse.urljoin(base, urllib.parse.quote(normalized))
    if cache_key:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}deployment={urllib.parse.quote(cache_key)}"
    return url


def parse_name_status(text: str) -> list[ChangedPath]:
    paths: list[ChangedPath] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        fields = line.split("\t")
        code = fields[0]
        status = code[0]
        if status in {"R", "C"} and len(fields) >= 3:
            old_path, new_path = fields[1], fields[2]
            paths.append(ChangedPath("D", old_path))
            paths.append(ChangedPath("A", new_path))
        elif len(fields) >= 2:
            paths.append(ChangedPath(status, fields[1]))
    return paths


def changed_paths(root: Path) -> list[ChangedPath]:
    command = ["git", "diff", "--name-status", "HEAD^", "HEAD"]
    result = subprocess.run(command, cwd=root, check=True, capture_output=True, text=True)
    parsed = parse_name_status(result.stdout)
    public = [item for item in parsed if is_public_path(item.path)]
    by_path = {item.path: item for item in public}
    for required in ALWAYS_CHECK:
        if (root / required).exists():
            by_path.setdefault(required, ChangedPath("M", required))
    return sorted(by_path.values(), key=lambda item: item.path)


def fetch(url: str, timeout: int = 30) -> tuple[int, bytes]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Free-HTL-Guide-Live-Deployment-Check/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def compare_once(root: Path, base_url: str, head_sha: str, paths: list[ChangedPath]) -> list[str]:
    problems: list[str] = []
    for item in paths:
        url = live_url(base_url, item.path, head_sha[:12])
        status, live_bytes = fetch(url)
        local = root / item.path
        if item.status == "D":
            if status != 404:
                problems.append(f"Deleted file still responds with HTTP {status}: {item.path}")
            continue
        if not local.exists():
            problems.append(f"Expected local deployment file is missing: {item.path}")
            continue
        expected = local.read_bytes()
        if status != 200:
            problems.append(f"Live file returned HTTP {status}: {item.path}")
        elif live_bytes != expected:
            problems.append(
                f"Live file differs from commit: {item.path} "
                f"(expected {digest(expected)[:12]}, received {digest(live_bytes)[:12]})"
            )
    return problems


def verify_sitemap(base_url: str, head_sha: str) -> list[str]:
    problems: list[str] = []
    status, sitemap_bytes = fetch(live_url(base_url, "sitemap.xml", head_sha[:12]))
    if status != 200:
        return [f"Live sitemap returned HTTP {status}"]
    try:
        root = ET.fromstring(sitemap_bytes)
    except ET.ParseError as exc:
        return [f"Live sitemap XML is invalid: {exc}"]
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [(node.text or "").strip() for node in root.findall("sm:url/sm:loc", namespace)]
    if not urls:
        return ["Live sitemap contains no canonical URLs"]
    for url in urls:
        status, _ = fetch(f"{url}{'&' if '?' in url else '?'}deployment={head_sha[:12]}")
        if status != 200:
            problems.append(f"Canonical URL returned HTTP {status}: {url}")
    return problems


def current_head(root: Path) -> str:
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."), help="Checked-out repository root")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Live GitHub Pages base URL")
    parser.add_argument("--head-sha", default="", help="Expected deployed commit SHA")
    parser.add_argument("--attempts", type=int, default=20, help="Maximum verification attempts")
    parser.add_argument("--delay", type=float, default=30, help="Seconds between attempts")
    args = parser.parse_args(argv)

    root = args.root.resolve()
    head_sha = args.head_sha or current_head(root)
    try:
        paths = changed_paths(root)
    except subprocess.CalledProcessError as exc:
        print(f"Unable to determine changed files: {exc}", file=sys.stderr)
        return 2

    print(f"Checking {len(paths)} public file(s) for commit {head_sha}.")
    final_problems: list[str] = []
    for attempt in range(1, max(args.attempts, 1) + 1):
        try:
            final_problems = compare_once(root, args.base_url, head_sha, paths)
            if not final_problems:
                final_problems = verify_sitemap(args.base_url, head_sha)
        except (OSError, urllib.error.URLError) as exc:
            final_problems = [f"Network verification error: {exc}"]

        if not final_problems:
            print(f"Live deployment matches commit {head_sha} and all sitemap URLs return HTTP 200.")
            return 0
        print(f"Attempt {attempt}/{args.attempts} found {len(final_problems)} pending issue(s):")
        for problem in final_problems:
            print(f"- {problem}")
        if attempt < args.attempts:
            time.sleep(max(args.delay, 0))

    for problem in final_problems:
        escaped = problem.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error::{escaped}")
    print("Live deployment verification failed.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
