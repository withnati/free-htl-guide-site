#!/usr/bin/env python3
"""Fail when internal implementation narration appears in learner-facing copy."""
from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

BANNED_PHRASES = (
    "production design",
    "server-controlled entitlement",
    "entitlement verification",
    "bearer session",
    "protected payload",
    "question payload",
    "private object",
    "private bucket",
    "edge function",
    "origin validation",
    "authorization architecture",
    "content-delivery proof",
    "layer 13",
    "layer 14",
    "layer 15",
    "staging-only proof",
    "server allowlist",
    "browser role",
    "current adapter",
    "account-ready record",
    "development records",
    "secure account development preview",
    "protected-delivery proof",
)

LEARNER_HTML = (
    "index.html",
    "404.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "faq.html",
    "privacy.html",
    "terms.html",
    "my-progress.html",
    "mock-exam.html",
    "targeted-practice.html",
    "account/auth-callback.html",
    "account/forgot-password.html",
    "account/reset-password.html",
    "account/settings.html",
    "account/sign-in.html",
    "account/sign-up.html",
    "account/verify-email.html",
    "premium/processing-proof.html",
    "premium/index.html",
    "templates/premium-preview.html",
    "templates/premium-preview.tpl",
)

LEARNER_JS = (
    "assets/auth-ui.js",
    "assets/cloud-progress-controller.js",
    "assets/dashboard.js",
    "assets/premium-content-client.js",
    "assets/premium-ui.js",
)

JS_STRING_PATTERNS = (
    re.compile(r"'((?:\\.|[^'\\])*)'", re.DOTALL),
    re.compile(r'"((?:\\.|[^"\\])*)"', re.DOTALL),
    re.compile(r"`((?:\\.|[^`\\])*)`", re.DOTALL),
)


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style", "template"}:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "template"} and self.depth:
            self.depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.depth and data.strip():
            self.parts.append(data)

    def text(self) -> str:
        return " ".join(self.parts)


def visible_html(path: Path) -> str:
    parser = VisibleTextParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.text()


def visible_js(path: Path) -> str:
    content = path.read_text(encoding="utf-8")
    values: list[str] = []
    for pattern in JS_STRING_PATTERNS:
        values.extend(match.group(1) for match in pattern.finditer(content))
    return " ".join(values)


def findings(root: Path) -> list[tuple[Path, str]]:
    results: list[tuple[Path, str]] = []
    for relative in LEARNER_HTML:
        path = root / relative
        if not path.is_file():
            results.append((path, "missing learner-facing file"))
            continue
        text = visible_html(path).casefold()
        for phrase in BANNED_PHRASES:
            if phrase in text:
                results.append((path, phrase))
    for relative in LEARNER_JS:
        path = root / relative
        if not path.is_file():
            results.append((path, "missing learner-facing file"))
            continue
        text = visible_js(path).casefold()
        for phrase in BANNED_PHRASES:
            if phrase in text:
                results.append((path, phrase))
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    root = args.root.resolve()
    matches = findings(root)
    if matches:
        for path, phrase in matches:
            try:
                relative = path.relative_to(root)
            except ValueError:
                relative = path
            print(f"::error file={relative}::Learner-facing copy contains prohibited narration: {phrase}")
        return 1
    print(f"Learner-facing copy validated across {len(LEARNER_HTML)} HTML and {len(LEARNER_JS)} JavaScript files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
