#!/usr/bin/env python3
import argparse
from pathlib import Path

REQUIRED_TABLES = (
    'profiles', 'module_progress', 'study_task_progress', 'learning_attempts',
    'attempt_domain_results', 'attempt_question_results', 'active_sessions',
    'active_session_responses', 'learning_activity', 'progress_migrations'
)
FORBIDDEN = ('service_role', 'sb_secret_', 'answer_key', 'question_text', 'explanation_text')


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    paths = {
        'adapter': root / 'assets/cloud-progress-adapter.js',
        'controller': root / 'assets/cloud-progress-controller.js',
        'dashboard': root / 'assets/dashboard.js',
        'page': root / 'my-progress.html',
    }
    for label, path in paths.items():
        if not path.exists():
            errors.append(f'Missing {label}: {path.relative_to(root)}')
    if errors:
        return errors

    adapter = paths['adapter'].read_text(encoding='utf-8')
    controller = paths['controller'].read_text(encoding='utf-8')
    dashboard = paths['dashboard'].read_text(encoding='utf-8')
    page = paths['page'].read_text(encoding='utf-8')

    for table in REQUIRED_TABLES:
        if table not in adapter:
            errors.append(f'Cloud adapter does not reference required table: {table}')
    for token in FORBIDDEN:
        if token.lower() in adapter.lower() or token.lower() in controller.lower():
            errors.append(f'Forbidden cloud-progress token found: {token}')

    required_adapter_tokens = (
        'class CloudProgressAdapter', 'ignoreDuplicates: true', 'hasCompletedMigration',
        'importRecord', 'mergeRecords', "this.name = 'supabase-cloud'",
        "owner: { kind: 'account'", 'active_session_responses'
    )
    for token in required_adapter_tokens:
        if token not in adapter:
            errors.append(f'Cloud adapter is missing contract token: {token}')

    required_flow_tokens = (
        'data-cloud-import', 'Importing and reconciling', 'hasCompletedMigration',
        'Use account progress only', 'reconnectAfterReset', 'localStorage.removeItem'
    )
    combined = controller + page
    for token in required_flow_tokens:
        if token not in combined:
            errors.append(f'Cloud import flow is missing contract token: {token}')

    scripts = (
        'supabase-config.js', 'auth-service.js', 'progress-service.js',
        'cloud-progress-adapter.js', 'cloud-progress-controller.js', 'dashboard.js'
    )
    positions = [page.find(script) for script in scripts]
    if any(position < 0 for position in positions):
        errors.append('My Progress is missing one or more cloud script dependencies.')
    elif positions != sorted(positions):
        errors.append('My Progress cloud scripts are not loaded in dependency order.')

    if 'reconnectAfterReset' not in dashboard or 'isConnected' not in dashboard:
        errors.append('Dashboard reset does not restore an account-owned cloud record.')
    if 'question text' not in page.lower() or 'answer keys' not in page.lower():
        errors.append('My Progress must state that question content and answer keys are excluded.')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root.resolve())
    if errors:
        print('\n'.join(f'ERROR: {error}' for error in errors))
        return 1
    print('Layer 13 cloud adapter and explicit import contract validated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())