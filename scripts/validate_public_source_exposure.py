#!/usr/bin/env python3
"""Freeze known public-repository Premium source exposure until Issue #68 is resolved.

This guard is intentionally not a content-protection claim. The repository is currently public,
and the legacy blobs listed below are already exposed in Git history. The purpose of this check is
to stop accidental incremental disclosure while still allowing a legacy source file to be replaced
with a preview-safe shell as part of future remediation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

CONTENT_ACCESS = Path("data/content-access.json")
PUBLIC_FREE_MODULE = Path("modules/fixation-guide-v3.html")

# Known legacy Premium lesson blobs already exposed by the public repository.
# Changing one of these files in place adds new proprietary material to public history and is blocked.
# Replacing one with a preview-safe shell is allowed so Issue #68 remediation is not obstructed.
LEGACY_PREMIUM_BLOBS = {
    Path("modules/processing-guide-v3.html"): "7118545cbd6a976dffc835294dc23025728f0239",
    Path("modules/embedding-guide-v3.html"): "d59acfbe019a0a3bb11e4d20e471371d3b8d2dfd",
    Path("modules/staining-he-guide.html"): "7cc9f2143a0e1ddbac37568370e8e397bfa4bb54",
    Path("modules/special-stains-guide.html"): "f3d64c22fcbe71c9b32c006a93588bd36dd55f79",
    Path("modules/lab-operations-guide.html"): "dae1111ac30438c0ca0f67e51f24e3f885b506e9",
    Path("modules/ihc-ish-guide.html"): "ce6012d73d5bfb4eea3fe313a9e2ac741c26d0f3",
}

ANSWER_KEY_MARKERS = ("data-correct=", "data-expl=")
FULL_LESSON_MARKERS = (
    '<article class="content">',
    '<section id="quiz"',
    "data-check=",
    *ANSWER_KEY_MARKERS,
)
PREVIEW_REQUIRED_MARKERS = (
    'data-page="premium-preview"',
    "data-premium-upgrade-action",
)


def git_blob_sha(data: bytes) -> str:
    """Return the Git blob SHA-1 for local file bytes."""
    header = f"blob {len(data)}\0".encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()


def is_preview_safe(content: str) -> bool:
    return (
        all(token in content for token in PREVIEW_REQUIRED_MARKERS)
        and not any(token in content for token in FULL_LESSON_MARKERS)
    )


def premium_module_paths(root: Path, issues: list[str]) -> set[Path]:
    path = root / CONTENT_ACCESS
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        issues.append(f"Missing content-access metadata: {CONTENT_ACCESS.as_posix()}")
        return set()
    except json.JSONDecodeError as error:
        issues.append(f"Invalid content-access metadata: {error}")
        return set()

    modules = payload.get("modules")
    if not isinstance(modules, list):
        issues.append("content-access metadata must contain a modules list")
        return set()

    result: set[Path] = set()
    for item in modules:
        if not isinstance(item, dict) or item.get("accessTier") != "premium":
            continue
        value = item.get("path")
        if not isinstance(value, str) or not value.strip():
            issues.append("Every Premium module must declare a source/preview path")
            continue
        result.add(Path(value))
    return result


def validate(root: Path) -> list[str]:
    root = root.resolve()
    issues: list[str] = []
    premium_paths = premium_module_paths(root, issues)

    for relative in sorted(premium_paths):
        path = root / relative
        if not path.is_file():
            # A generated preview route may intentionally have no proprietary source file in this repo.
            continue
        data = path.read_bytes()
        content = data.decode("utf-8", errors="replace")
        legacy_sha = LEGACY_PREMIUM_BLOBS.get(relative)

        if legacy_sha and git_blob_sha(data) == legacy_sha:
            continue
        if is_preview_safe(content):
            continue

        if legacy_sha:
            issues.append(
                f"{relative.as_posix()} changed from its frozen legacy Premium blob while the repository "
                "remains public. Replace it with a preview-safe shell or resolve Issue #68 before editing "
                "proprietary lesson content."
            )
        else:
            issues.append(
                f"New Premium module source is not preview-safe: {relative.as_posix()}. Do not add "
                "proprietary Premium lesson content to public Git history while Issue #68 is unresolved."
            )

    modules_root = root / "modules"
    if modules_root.is_dir():
        for path in sorted(modules_root.glob("*.html")):
            relative = path.relative_to(root)
            content = path.read_text(encoding="utf-8", errors="replace")
            if not any(marker in content for marker in ANSWER_KEY_MARKERS):
                continue
            if relative == PUBLIC_FREE_MODULE:
                continue
            legacy_sha = LEGACY_PREMIUM_BLOBS.get(relative)
            if legacy_sha and git_blob_sha(path.read_bytes()) == legacy_sha:
                continue
            issues.append(
                f"Answer-key metadata is exposed in a non-public module source: {relative.as_posix()}. "
                "Only the known frozen legacy blobs may remain until Issue #68 is remediated."
            )

    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root)
    if issues:
        print("Public Premium source exposure freeze failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(
        "Public Premium source exposure freeze passed: no new proprietary module/answer-key source "
        "was added beyond the frozen Issue #68 legacy boundary."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
