#!/usr/bin/env python3
"""Validate the Layer 13 authentication and cloud-progress foundation."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

MIGRATION = "supabase/migrations/20260801000000_layer_13_auth_cloud_progress.sql"
ARCHITECTURE = "docs/LAYER_13_AUTH_CLOUD_PROGRESS.md"
SUPABASE_README = "supabase/README.md"

EXPECTED_TABLES = {
    "profiles",
    "module_progress",
    "study_task_progress",
    "learning_attempts",
    "attempt_domain_results",
    "attempt_question_results",
    "active_sessions",
    "active_session_responses",
    "learning_activity",
    "progress_migrations",
}

DIRECT_AUTH_TABLES = {
    "profiles",
    "module_progress",
    "study_task_progress",
    "learning_attempts",
    "active_sessions",
    "learning_activity",
    "progress_migrations",
}

IMMUTABLE_ATTEMPT_TABLES = {
    "learning_attempts",
    "attempt_domain_results",
    "attempt_question_results",
    "learning_activity",
}

FORBIDDEN_COLUMNS = {
    "question_text",
    "answer_key",
    "correct_answer",
    "explanation",
    "email_address",
    "analytics_consent",
    "theme",
    "personal_notes",
}

TABLE_RE = re.compile(
    r"create\s+table\s+public\.(?P<name>[a-z0-9_]+)\s*\((?P<body>.*?)\n\);",
    re.IGNORECASE | re.DOTALL,
)


def read(path: Path, issues: list[str]) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        issues.append(f"Missing required file: {path}")
        return ""


def table_blocks(sql: str) -> dict[str, str]:
    return {
        match.group("name").lower(): match.group("body").lower()
        for match in TABLE_RE.finditer(sql)
    }


def validate_migration(root: Path) -> list[str]:
    issues: list[str] = []
    path = root / MIGRATION
    sql = read(path, issues)
    if not sql:
        return issues

    lower = sql.lower()
    blocks = table_blocks(sql)
    missing_tables = EXPECTED_TABLES - set(blocks)
    extra_tables = set(blocks) - EXPECTED_TABLES
    for table in sorted(missing_tables):
        issues.append(f"Cloud migration is missing table public.{table}")
    for table in sorted(extra_tables):
        issues.append(f"Unexpected Layer 13 table public.{table}; update the validator and architecture intentionally")

    for table in sorted(EXPECTED_TABLES & set(blocks)):
        rls = f"alter table public.{table} enable row level security;"
        if rls not in lower:
            issues.append(f"public.{table} must enable Row Level Security")
        revoke = f"revoke all on table public.{table} from anon;"
        if revoke not in lower:
            issues.append(f"public.{table} must explicitly deny anon table privileges")

        body = blocks[table]
        for column in FORBIDDEN_COLUMNS:
            if re.search(rf"\b{re.escape(column)}\b", body):
                issues.append(f"public.{table} contains prohibited cloud-progress column {column}")

    for table in sorted(DIRECT_AUTH_TABLES & set(blocks)):
        body = blocks[table]
        if "references auth.users(id) on delete cascade" not in body:
            issues.append(f"public.{table} must reference auth.users(id) with cascade deletion")

    for table in ("attempt_domain_results", "attempt_question_results"):
        body = blocks.get(table, "")
        required = "references public.learning_attempts(user_id, attempt_id) on delete cascade"
        if required not in re.sub(r"\s+", " ", body):
            issues.append(f"public.{table} must cascade from the owning learning attempt")

    response_body = blocks.get("active_session_responses", "")
    if "references public.active_sessions(user_id, session_type) on delete cascade" not in re.sub(
        r"\s+", " ", response_body
    ):
        issues.append("active_session_responses must cascade from the owning active session")

    active_body = blocks.get("active_sessions", "")
    if re.search(r"\b(json|jsonb)\b", active_body):
        issues.append("active_sessions must not use unrestricted JSON for learner responses")
    if "question_ids text[]" not in active_body:
        issues.append("active_sessions must preserve ordered stable question IDs")

    question_body = blocks.get("attempt_question_results", "")
    for field in ("question_id text", "source_question_id text", "selected_option_id text"):
        if field not in question_body:
            issues.append(f"attempt_question_results is missing stable-ID field: {field}")

    normalized = re.sub(r"\s+", " ", lower)
    if normalized.count("(select auth.uid()) = user_id") < len(EXPECTED_TABLES):
        issues.append("Every learner-owned table must have an auth.uid()-based ownership policy")
    if "security definer" not in lower or "function public.handle_new_user" not in lower:
        issues.append("The auth-user profile trigger must use a narrowly scoped security-definer function")
    if "after insert on auth.users" not in normalized:
        issues.append("New Auth users must receive a profile through an auth.users insert trigger")

    for table in IMMUTABLE_ATTEMPT_TABLES:
        update_grant = f"grant select, insert, update, delete on table public.{table}"
        if update_grant in lower:
            issues.append(f"public.{table} should remain append-only in normal authenticated use")

    if "service_role" in lower or "service-role" in lower:
        issues.append("The database migration must not embed or depend on a service-role credential")

    if not lower.strip().startswith("begin;") or not lower.strip().endswith("commit;"):
        issues.append("The initial Layer 13 migration must be transactional")
    return issues


def validate_documentation(root: Path) -> list[str]:
    issues: list[str] = []
    architecture = read(root / ARCHITECTURE, issues)
    readme = read(root / SUPABASE_README, issues)
    gitignore = read(root / ".gitignore", issues)
    workflow = read(root / ".github/workflows/site-quality.yml", issues)
    architecture_lower = architecture.lower()

    for token in (
        "cloudprogressadapter",
        "row level security",
        "anonymous-to-account migration",
        "stable `(user_id, attempt_id)`",
        "layer 14",
    ):
        if token not in architecture_lower:
            issues.append(f"Layer 13 architecture document is missing required decision: {token}")

    for token in ("supabase db reset", "supabase db lint", "supabase test db"):
        if token not in readme:
            issues.append(f"Supabase README is missing local-development command: {token}")

    for token in (".env", "supabase/.temp/", ".supabase/"):
        if token not in gitignore:
            issues.append(f".gitignore is missing secret/local-state rule: {token}")

    if "scripts/validate_cloud_progress.py" not in workflow:
        issues.append("Site Quality workflow must run validate_cloud_progress.py")
    return issues


def validate(root: Path) -> list[str]:
    return validate_migration(root) + validate_documentation(root)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root.resolve())
    if issues:
        print("Layer 13 cloud-progress validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(
        "Layer 13 cloud-progress validation passed: relational learner records, RLS ownership, "
        "anonymous denial, stable IDs, and secret boundaries are intact."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
