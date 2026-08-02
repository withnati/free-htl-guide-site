#!/usr/bin/env python3
"""Inventory likely legacy question sources without altering learner content."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
from typing import Iterable

TEXT_SUFFIXES = {'.html', '.js', '.json', '.md'}
QUESTION_SIGNALS = (
    'question', 'questions', 'correct_option', 'correctanswer', 'correctAnswer',
    'rationale', 'explanation', 'distractor', 'mock exam', 'targeted practice',
)
EXCLUDED_PARTS = {'.git', 'node_modules', 'dist', 'playwright-report', 'test-results'}


def candidate_files(root: Path) -> Iterable[Path]:
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in EXCLUDED_PARTS for part in path.parts):
            continue
        yield path


def inspect(path: Path, root: Path) -> dict[str, object] | None:
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return None
    lowered = text.casefold()
    matches = sorted({signal for signal in QUESTION_SIGNALS if signal.casefold() in lowered})
    if not matches:
        return None
    likely_count = max(
        len(re.findall(r'\bquestion\s*[:=]', text, flags=re.IGNORECASE)),
        len(re.findall(r'"(?:stem|question)"\s*:', text, flags=re.IGNORECASE)),
    )
    relative = path.relative_to(root).as_posix()
    public_candidate = relative.endswith('.html') or relative.startswith(('assets/', 'modules/'))
    return {
        'source_path': relative,
        'format': path.suffix.lower().lstrip('.'),
        'signals': matches,
        'estimated_inline_records': likely_count,
        'public_surface_candidate': public_candidate,
        'migration_status': 'inventory_only',
        'review_status': 'unknown',
        'notes': 'Requires source-specific inspection before canonical mapping.',
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    records = [record for path in candidate_files(root) if (record := inspect(path, root))]
    records.sort(key=lambda item: str(item['source_path']))
    payload = {
        'schema_version': 1,
        'generated_by': 'scripts/inventory_question_sources.py',
        'source_count': len(records),
        'sources': records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(f"Inventoried {len(records)} likely question source(s).")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
