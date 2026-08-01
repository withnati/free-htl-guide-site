#!/usr/bin/env python3
import argparse
from pathlib import Path

REQUIRED_TABLES = (
    'profiles', 'module_progress', 'study_task_progress', 'learning_attempts',
    'attempt_domain_results', 'attempt_question_results', 'active_sessions',
    'active_session_responses', 'learning_activity', 'progress_migrations'
)
FORBIDDEN = ('service_role', 'sb_secret_', 'answer_key', 'question_text', 'explanation_text')
DECISION_KEY = 'free-htl-cloud-sync-v1'


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    paths = {
        'adapter': root / 'assets/cloud-progress-adapter.js',
        'resilience': root / 'assets/resilient-cloud-adapter.js',
        'controller': root / 'assets/cloud-progress-controller.js',
        'bootstrap': root / 'assets/cloud-sync-bootstrap.js',
        'sync_style': root / 'assets/cloud-sync.css',
        'shared_loader': root / 'assets/authority.js',
        'dashboard': root / 'assets/dashboard.js',
        'page': root / 'my-progress.html',
        'privacy': root / 'privacy.html',
    }
    for label, path in paths.items():
        if not path.exists():
            errors.append(f'Missing {label}: {path.relative_to(root)}')
    if errors:
        return errors

    adapter = paths['adapter'].read_text(encoding='utf-8')
    resilience = paths['resilience'].read_text(encoding='utf-8')
    controller = paths['controller'].read_text(encoding='utf-8')
    bootstrap = paths['bootstrap'].read_text(encoding='utf-8')
    sync_style = paths['sync_style'].read_text(encoding='utf-8')
    shared_loader = paths['shared_loader'].read_text(encoding='utf-8')
    dashboard = paths['dashboard'].read_text(encoding='utf-8')
    page = paths['page'].read_text(encoding='utf-8')
    privacy = paths['privacy'].read_text(encoding='utf-8')

    for table in REQUIRED_TABLES:
        if table not in adapter:
            errors.append(f'Cloud adapter does not reference required table: {table}')
    for token in FORBIDDEN:
        if any(token.lower() in content.lower() for content in (adapter, resilience, controller, bootstrap)):
            errors.append(f'Forbidden cloud-progress token found: {token}')

    required_adapter_tokens = (
        'class CloudProgressAdapter', 'ignoreDuplicates: true', 'hasCompletedMigration',
        'importRecord', 'mergeRecords', "this.name = 'supabase-cloud'",
        "owner: { kind: 'account'", 'active_session_responses'
    )
    for token in required_adapter_tokens:
        if token not in adapter:
            errors.append(f'Cloud adapter is missing contract token: {token}')

    required_resilience_tokens = (
        'class ResilientCloudAdapter',
        'class CloudProgressConflictError',
        'free-htl-cloud-pending-v1:',
        'free-htl-cloud-cache-v1:',
        "emit('saving'",
        "emit('saved'",
        'assertNoSessionConflicts(record)',
        'serverRevision > localRevision',
        'resolveConflict(strategy)',
        "strategy === 'remote'",
        "strategy === 'local'",
        'return this.save(pending)',
        'hasPending()',
        'navigator.onLine'
    )
    for token in required_resilience_tokens:
        if token not in resilience:
            errors.append(f'Resilient cloud adapter is missing contract token: {token}')

    required_flow_tokens = (
        'data-cloud-import', 'Adding this device’s study progress', 'hasCompletedMigration',
        'Use progress already in my account', 'reconnectAfterReset', 'localStorage.removeItem',
        DECISION_KEY, "mode === 'imported'", "'account-only'",
        'ResilientCloudAdapter', 'adapter.hasPending()',
        'data-cloud-conflict', 'Continue newer account session', "Continue this device’s session",
        "resolveConflict('remote')", "resolveConflict('local')"
    )
    combined = controller + page + dashboard
    for token in required_flow_tokens:
        if token not in combined:
            errors.append(f'Cloud import or conflict flow is missing contract token: {token}')

    required_bootstrap_tokens = (
        DECISION_KEY,
        'CloudProgressAdapter',
        'ResilientCloudAdapter',
        'service.useAdapter(adapter)',
        'session.user.id !== decision.userId',
        "emit('signed-out')",
        "emit('account-mismatch')",
        "adapter.hasPending() ? 'offline' : 'connected'",
        'mergeRecords(remoteRecord, localRecord',
        'lastLocalSyncAt',
        'cloud-sync.css',
        'data-cloud-sync-indicator'
    )
    for token in required_bootstrap_tokens:
        if token not in bootstrap:
            errors.append(f'Site-wide cloud bootstrap is missing contract token: {token}')

    if '.cloud-sync-indicator' not in sync_style or 'data-state="offline"' not in sync_style:
        errors.append('Cloud sync stylesheet must define the visible status indicator and offline state.')
    if 'cloud-sync-bootstrap.js' not in shared_loader or DECISION_KEY not in shared_loader:
        errors.append('The shared site runtime must conditionally load cloud-sync-bootstrap.js after an approved decision.')
    if "pageKey === 'account'" not in shared_loader or "pageKey === 'my-progress'" not in shared_loader:
        errors.append('The shared cloud loader must avoid duplicate initialization on account and dashboard pages.')

    scripts = (
        'supabase-config.js', 'auth-service.js', 'progress-service.js',
        'cloud-progress-adapter.js', 'resilient-cloud-adapter.js',
        'cloud-progress-controller.js', 'dashboard.js'
    )
    positions = [page.find(script) for script in scripts]
    if any(position < 0 for position in positions):
        errors.append('My Progress is missing one or more cloud script dependencies.')
    elif positions != sorted(positions):
        errors.append('My Progress cloud scripts are not loaded in dependency order.')

    if 'reconnectAfterReset' not in dashboard or 'isConnected' not in dashboard:
        errors.append('Dashboard reset does not restore an account-owned cloud record.')
    if 'full question text' not in privacy.lower() or 'answer keys' not in privacy.lower():
        errors.append('The Privacy Policy must state that full question content and answer keys are excluded from learning records.')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root.resolve())
    if errors:
        print('\n'.join(f'ERROR: {error}' for error in errors))
        return 1
    print('Layer 13 cloud adapter, import, site-wide activation, resilience, and conflict contract validated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
