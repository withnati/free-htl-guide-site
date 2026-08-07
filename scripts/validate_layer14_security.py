#!/usr/bin/env python3
"""Validate the Layer 14 hosting, entitlement, and protected-delivery contract."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ARCHITECTURE_DOC = "docs/LAYER_14_ARCHITECTURE_DECISION.md"
ENVIRONMENT_DOC = "docs/LAYER_14_ENVIRONMENT_PLAN.md"
CONTENT_DOC = "docs/LAYER_14_CONTENT_BOUNDARY.md"
ROADMAP_DOC = "docs/ROADMAP.md"
ENTITLEMENT_MIGRATION = "supabase/migrations/20260801060000_layer_14_entitlements.sql"
PREMIUM_FUNCTION = "supabase/functions/premium-content/index.ts"
PREMIUM_PAGE = "premium/processing-proof.html"
STUDY_PLAN_PAGE = "premium/study-plan.html"
PREMIUM_CLIENT = "assets/premium-content-client.js"
PREMIUM_STYLE = "assets/premium-access.css"
PREMIUM_BROWSER_TEST = "browser-tests/premium-content.spec.cjs"
BROWSER_WORKFLOW = ".github/workflows/browser-quality.yml"
SECURITY_WORKFLOW = ".github/workflows/layer-14-security.yml"


def read(path: Path, issues: list[str]) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        issues.append(f"Missing required file: {path}")
        return ""


def validate_documents(root: Path) -> list[str]:
    issues: list[str] = []
    required_tokens = {
        ARCHITECTURE_DOC: (
            "Cloudflare Pages",
            "Supabase Edge Functions",
            "Private Supabase Storage",
            "Authentication proves identity only",
            "No merge or production deployment",
        ),
        ENVIRONMENT_DOC: (
            "Local development",
            "Preview / staging",
            "Production",
            "Production and staging must not use the same Supabase project",
            "RawGitHack",
        ),
        CONTENT_DOC: (
            "Public acquisition content",
            "Free account content",
            "Premium account content",
            "Server-only content and operations",
            "public build",
        ),
        ROADMAP_DOC: (
            "Layer 14",
            "Layer 15",
            "Layer 16",
            "80 alternate scenarios",
        ),
    }
    for relative, tokens in required_tokens.items():
        content = read(root / relative, issues)
        for token in tokens:
            if content and token not in content:
                issues.append(f"{relative} is missing required decision token: {token}")
    return issues


def validate_dependency_lock(root: Path) -> list[str]:
    issues: list[str] = []
    package_content = read(root / "package.json", issues)
    lock_content = read(root / "package-lock.json", issues)
    workflow = read(root / BROWSER_WORKFLOW, issues)
    readme = read(root / "README.md", issues)
    if not package_content or not lock_content:
        return issues

    try:
        package = json.loads(package_content)
        lock = json.loads(lock_content)
    except json.JSONDecodeError as error:
        issues.append(f"Invalid package metadata JSON: {error}")
        return issues

    expected = package.get("devDependencies", {}).get("@playwright/test")
    locked = lock.get("packages", {}).get("node_modules/@playwright/test", {}).get("version")
    root_locked = lock.get("packages", {}).get("", {}).get("devDependencies", {}).get("@playwright/test")
    if not expected:
        issues.append("package.json must pin @playwright/test")
    if expected != locked or expected != root_locked:
        issues.append("package-lock.json must lock the exact @playwright/test version from package.json")
    if lock.get("lockfileVersion") != 3:
        issues.append("package-lock.json must use lockfileVersion 3")
    if "npm ci --ignore-scripts --no-audit --no-fund" not in workflow:
        issues.append("Browser Quality must install dependencies with deterministic npm ci")
    if re.search(r"\bnpm install\b", workflow):
        issues.append("Browser Quality must not use npm install")
    if "package-manager-cache: npm" not in workflow:
        issues.append("Browser Quality must use the npm lockfile cache")
    if "npm ci --ignore-scripts --no-audit --no-fund" not in readme:
        issues.append("README must document the deterministic npm ci command")
    return issues


def validate_entitlements(root: Path) -> list[str]:
    issues: list[str] = []
    migration = read(root / ENTITLEMENT_MIGRATION, issues)
    if not migration:
        return issues
    required = (
        "create table public.entitlements",
        "create table public.entitlement_events",
        "alter table public.entitlements enable row level security",
        "alter table public.entitlement_events enable row level security",
        "revoke all on table public.entitlements from authenticated",
        "revoke all on table public.entitlement_events from authenticated",
        "revoke all on function public.has_effective_entitlement(uuid, text, timestamptz) from public",
        "revoke all on function public.has_effective_entitlement(uuid, text, timestamptz) from authenticated",
        "grant execute on function public.has_effective_entitlement(uuid, text, timestamptz) to service_role",
        "status in (",
        "'trial'",
        "'premium'",
        "'grace'",
        "'canceled'",
        "'expired'",
        "'revoked'",
        "'administrative'",
        "'institutional'",
        "insert into storage.buckets",
        "'premium-content'",
    )
    lowered = migration.lower()
    for token in required:
        if token.lower() not in lowered:
            issues.append(f"Layer 14 entitlement migration is missing required token: {token}")
    if re.search(r"create\s+policy[\s\S]{0,500}on\s+public\.entitlements[\s\S]{0,300}to\s+authenticated", lowered):
        issues.append("Authenticated browser users must not receive a direct entitlement-table policy")
    if not re.search(
        r"values\s*\(\s*'premium-content'\s*,\s*'premium-content'\s*,\s*false\s*,",
        lowered,
    ):
        issues.append("The premium-content storage bucket must be created with public=false")
    if "public = false" not in lowered:
        issues.append("The premium-content upsert must preserve public=false")
    if re.search(r"grant\s+[^;]+on\s+table\s+public\.entitlements\s+to\s+(?:anon|authenticated)", lowered):
        issues.append("Browser roles must not receive direct entitlement-table grants")
    return issues


def validate_protected_function(root: Path) -> list[str]:
    issues: list[str] = []
    function = read(root / PREMIUM_FUNCTION, issues)
    if not function:
        return issues
    required = (
        "CONTENT_ALLOWLIST",
        "'study-plan-v1'",
        "objectPath: 'plans/study-plan-v1.json'",
        "FHL_ALLOWED_ORIGINS",
        "configured.split(',')",
        "value !== '*'",
        "authorization.startsWith('Bearer ')",
        "userClient.auth.getUser()",
        "SUPABASE_SERVICE_ROLE_KEY",
        "has_effective_entitlement",
        "requested_user_id: userData.user.id",
        "requested_product_code: protectedContent.productCode",
        ".from(bucket)",
        ".download(protectedContent.objectPath)",
        "Cache-Control",
        "private, no-store",
        "upgrade_required",
        "X-Content-Type-Options",
        "requestId",
    )
    for token in required:
        if token not in function:
            issues.append(f"premium-content Edge Function is missing required security token: {token}")

    prohibited = (
        "https://withnati.github.io",
        "https://raw.githack.com",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "createSignedUrl(",
        "payload.userId",
        "payload.user_id",
    )
    for token in prohibited:
        if token in function:
            issues.append(f"premium-content Edge Function contains prohibited token: {token}")
    if re.search(r"Access-Control-Allow-Origin[^\n]{0,120}['\"]\*['\"]", function):
        issues.append("premium-content Edge Function must not use a wildcard CORS origin")
    if re.search(r"\.from\((?:payload|request|contentId)", function):
        issues.append("The premium storage bucket must not be selected from caller-controlled input")
    if re.search(r"\.download\((?:payload|request|contentId)", function):
        issues.append("The private object path must come only from the server allowlist")
    if re.search(r"requested_user_id\s*:\s*(?:payload|request)", function):
        issues.append("The entitlement user ID must come only from the verified bearer token")
    return issues


def validate_protected_entry(root: Path) -> list[str]:
    issues: list[str] = []
    page = read(root / PREMIUM_PAGE, issues)
    study_plan_page = read(root / STUDY_PLAN_PAGE, issues)
    client = read(root / PREMIUM_CLIENT, issues)
    style = read(root / PREMIUM_STYLE, issues)
    browser_test = read(root / PREMIUM_BROWSER_TEST, issues)

    if page:
        required_page = (
            'content="noindex,nofollow"',
            'rel="canonical"',
            'data-protected-content-id="processing-proof-v1"',
            'data-premium-state="loading"',
            'data-premium-sign-in',
            'data-premium-upgrade',
            'data-premium-retry',
            'data-premium-content',
            '../assets/premium-content-client.js',
        )
        for token in required_page:
            if token not in page:
                issues.append(f"Protected proof page is missing required token: {token}")
        if "proof/processing-proof-v1.json" in page:
            issues.append("Protected proof page must not expose the private storage object path")
        if re.search(r"data-(?:premium|entitlement)-(?:granted|active)\s*=", page, re.IGNORECASE):
            issues.append("Protected proof page must not contain client-controlled entitlement flags")

    if study_plan_page:
        required_study_plan_page = (
            'content="noindex,nofollow"',
            'rel="canonical"',
            'data-protected-content-id="study-plan-v1"',
            'data-protected-content-label="study plan"',
            'data-premium-state="loading"',
            'data-premium-task-status',
            'assets/progress-service.js',
            'assets/cloud-sync-bootstrap.js',
            'assets/premium-content-client.js',
        )
        for token in required_study_plan_page:
            if token not in study_plan_page:
                issues.append(f"Protected study-plan page is missing required token: {token}")
        if "plans/study-plan-v1.json" in study_plan_page:
            issues.append("Protected study-plan page must not expose the private storage object path")
        if re.search(r"data-(?:premium|entitlement)-(?:granted|active)\s*=", study_plan_page, re.IGNORECASE):
            issues.append("Protected study-plan page must not contain client-controlled entitlement flags")

    if client:
        required_client = (
            "auth.ready",
            "session.access_token",
            "Authorization: `Bearer ${session.access_token}`",
            "body: JSON.stringify({ contentId })",
            "credentials: 'omit'",
            "cache: 'no-store'",
            "response.status === 401",
            "payload.code === 'upgrade_required'",
            "validatePayload(payload)",
            "payload.contentId !== contentId",
            "section.tasks",
            "progress.recordStudyTask",
            "window.FreeHTLCloudSync?.ready",
            "textContent",
        )
        for token in required_client:
            if token not in client:
                issues.append(f"premium-content client is missing required token: {token}")
        for prohibited in (
            "localStorage",
            "sessionStorage",
            ".innerHTML",
            "proof/processing-proof-v1.json",
            "plans/study-plan-v1.json",
            "SUPABASE_SERVICE_ROLE_KEY",
            "payload.userId",
            "payload.entitlement",
            "payload.bucket",
            "payload.objectPath",
        ):
            if prohibited in client:
                issues.append(f"premium-content client contains prohibited authorization/content token: {prohibited}")

    if style:
        for token in ("prefers-reduced-motion", "@media (max-width: 640px)", ".premium-state"):
            if token not in style:
                issues.append(f"Premium access styling is missing responsive/accessibility token: {token}")

    if browser_test:
        required_test = (
            "signed-out learner",
            "verified free learner",
            "invalid or expired session",
            "entitled learner",
            "expect(calls[0].body).toEqual({ contentId: 'processing-proof-v1' })",
            "expect(calls[0].body.userId).toBeUndefined()",
            "expect(calls[0].body.objectPath).toBeUndefined()",
            "entitled learner opens the protected study plan and retains task progress",
            "expect(calls[0].body).toEqual({ contentId: 'study-plan-v1' })",
            "snapshot.studyTasks['study-plan-v1:w1d1']",
        )
        for token in required_test:
            if token not in browser_test:
                issues.append(f"Premium browser coverage is missing required token: {token}")
    return issues


def validate_environment_template(root: Path) -> list[str]:
    issues: list[str] = []
    template = read(root / ".env.example", issues)
    if not template:
        return issues
    required = (
        "FHL_ENVIRONMENT=local",
        "FHL_PUBLIC_SITE_URL=",
        "FHL_SUPABASE_URL=",
        "FHL_SUPABASE_PUBLISHABLE_KEY=",
    )
    for token in required:
        if token not in template:
            issues.append(f".env.example is missing browser-safe variable: {token}")
    if re.search(r"^SUPABASE_SERVICE_ROLE_KEY=.+", template, re.MULTILINE):
        issues.append(".env.example must not assign a service-role value")
    if "sb_secret_" in template or "postgresql://" in template:
        issues.append(".env.example contains prohibited secret material")
    return issues


def validate_secret_scan(root: Path) -> list[str]:
    issues: list[str] = []
    ignored_parts = {".git", "node_modules", "playwright-report", "test-results", ".supabase"}
    patterns = (
        (re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}"), "Supabase secret key"),
        (re.compile(r"github_pat_[A-Za-z0-9_]{12,}"), "GitHub personal access token"),
        (re.compile(r"ghp_[A-Za-z0-9]{20,}"), "GitHub personal access token"),
        (re.compile(r"postgres(?:ql)?://[^\s:'\"]+:[^\s@'\"]+@", re.IGNORECASE), "database credential URL"),
        (re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}"), "JWT-like credential"),
    )
    text_suffixes = {".js", ".ts", ".json", ".html", ".md", ".py", ".sql", ".yml", ".yaml", ".txt"}
    for path in root.rglob("*"):
        if not path.is_file() or any(part in ignored_parts for part in path.parts):
            continue
        if path.name != ".env.example" and path.suffix.lower() not in text_suffixes:
            continue
        try:
            if path.stat().st_size > 2_000_000:
                continue
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for pattern, label in patterns:
            if pattern.search(content):
                issues.append(f"Potential {label} found in {path.relative_to(root)}")
    return issues


def validate_public_proof_absence(root: Path) -> list[str]:
    issues: list[str] = []
    prohibited_paths = (
        "proof/processing-proof-v1.json",
        "data/processing-proof-v1.json",
        "assets/processing-proof-v1.json",
        "public/proof/processing-proof-v1.json",
        "premium-content/processing-proof-v1.json",
        "plans/study-plan-v1.json",
        "data/study-plan-v1.json",
        "assets/study-plan-v1.json",
        "public/plans/study-plan-v1.json",
        "premium-content/study-plan-v1.json",
    )
    for relative in prohibited_paths:
        if (root / relative).exists():
            issues.append(f"Protected proof payload must not be committed to public build paths: {relative}")

    object_paths = ("proof/processing-proof-v1.json", "plans/study-plan-v1.json")
    allowed_references = {
        Path(PREMIUM_FUNCTION),
        Path("scripts/validate_layer14_security.py"),
        Path("docs/LAYER_14_ENTITLEMENTS_AND_PROOF.md"),
    }
    for directory in ("assets", "data", "modules", "premium"):
        base = root / directory
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if any(object_path in content for object_path in object_paths) and path.relative_to(root) not in allowed_references:
                issues.append(f"Private proof object path leaked into public source: {path.relative_to(root)}")
    return issues


def validate_security_workflow(root: Path) -> list[str]:
    issues: list[str] = []
    workflow = read(root / SECURITY_WORKFLOW, issues)
    if not workflow:
        return issues
    required = (
        "scripts/validate_layer14_security.py",
        "permissions:\n  contents: read",
        "pull_request:",
        "branches: [main]",
    )
    for token in required:
        if token not in workflow:
            issues.append(f"Layer 14 Security workflow is missing required token: {token}")
    return issues


def validate(root: Path) -> list[str]:
    return (
        validate_documents(root)
        + validate_dependency_lock(root)
        + validate_entitlements(root)
        + validate_protected_function(root)
        + validate_protected_entry(root)
        + validate_environment_template(root)
        + validate_secret_scan(root)
        + validate_public_proof_absence(root)
        + validate_security_workflow(root)
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    issues = validate(args.root.resolve())
    if issues:
        print("Layer 14 security validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(
        "Layer 14 security validation passed: environment separation, deterministic dependencies, "
        "server-controlled entitlements, private delivery, learner states, secret boundaries, and proof containment are intact."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
