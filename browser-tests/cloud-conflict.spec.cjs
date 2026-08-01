const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

function pendingRecord() {
  return {
    schemaVersion: 2,
    recordId: 'account-user-a',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T07:00:00.000Z',
    owner: { kind: 'account', anonymousId: null, accountId: 'user-a' },
    entitlement: { tier: 'public', status: 'preview', source: 'server-development', updatedAt: '2026-08-01T00:00:00.000Z' },
    modules: {},
    studyTasks: {},
    quizAttempts: [],
    mockExamAttempts: [],
    targetedPracticeAttempts: [],
    activeSessions: {
      'mock-exam': {
        attemptId: 'local-session',
        examId: 'free-htl-mock-50',
        mode: 'untimed',
        startedAt: '2026-08-01T04:00:00.000Z',
        currentIndex: 8,
        questionIds: ['q1', 'q2'],
        responses: { q1: 'b' },
        flags: [],
        updatedAt: '2026-08-01T07:00:00.000Z',
        revision: 1
      }
    },
    activity: [],
    migration: { legacyVersion: 1, completedAt: null, importedRecords: 0 }
  };
}

async function installConflictMock(page) {
  const tables = {
    profiles: [{ user_id: 'user-a', display_name: 'Learner A', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z' }],
    active_sessions: [{
      user_id: 'user-a',
      session_type: 'mock-exam',
      session_id: 'remote-session',
      activity_id: 'free-htl-mock-50',
      mode: 'timed',
      source_mode: null,
      selected_domains: [],
      selected_difficulties: [],
      requested_count: null,
      current_index: 15,
      question_ids: ['q1', 'q2', 'q3'],
      started_at: '2026-08-01T03:00:00.000Z',
      expires_at: null,
      client_updated_at: '2026-08-01T06:00:00.000Z',
      server_updated_at: '2026-08-01T06:00:00.000Z',
      revision: 3
    }],
    active_session_responses: [{
      user_id: 'user-a', session_type: 'mock-exam', question_id: 'q1',
      selected_option_id: 'c', is_flagged: false, feedback_checked: false,
      updated_at: '2026-08-01T06:00:00.000Z'
    }]
  };
  const script = `
    (() => {
      const tables = ${JSON.stringify(tables)};
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const matches = (row, filters) => filters.every(([key, value]) => row[key] === value);
      function builder(table) {
        let operation = 'select';
        let payload = null;
        let filters = [];
        let options = {};
        let limitValue = null;
        const api = {
          select() { operation = 'select'; return api; },
          eq(key, value) { filters.push([key, value]); return api; },
          limit(value) { limitValue = value; return api; },
          upsert(value, nextOptions = {}) { operation = 'upsert'; payload = Array.isArray(value) ? value : [value]; options = nextOptions; return api; },
          insert(value) { operation = 'insert'; payload = Array.isArray(value) ? value : [value]; return api; },
          update(value) { operation = 'update'; payload = value; return api; },
          delete() { operation = 'delete'; return api; },
          then(resolve, reject) { execute().then(resolve, reject); }
        };
        async function execute() {
          tables[table] ||= [];
          if (operation === 'select') {
            let rows = tables[table].filter((row) => matches(row, filters));
            if (limitValue !== null) rows = rows.slice(0, limitValue);
            return { data: clone(rows), error: null };
          }
          if (operation === 'delete') {
            tables[table] = tables[table].filter((row) => !matches(row, filters));
            return { data: [], error: null };
          }
          if (operation === 'update') {
            tables[table].forEach((row) => { if (matches(row, filters)) Object.assign(row, clone(payload)); });
            return { data: [], error: null };
          }
          if (operation === 'insert') {
            tables[table].push(...clone(payload));
            return { data: clone(payload), error: null };
          }
          const keys = String(options.onConflict || '').split(',').filter(Boolean);
          for (const incoming of payload) {
            const index = keys.length ? tables[table].findIndex((row) => keys.every((key) => row[key] === incoming[key])) : -1;
            if (index >= 0) {
              if (!options.ignoreDuplicates) tables[table][index] = { ...tables[table][index], ...clone(incoming) };
            } else {
              tables[table].push(clone(incoming));
            }
          }
          return { data: clone(payload), error: null };
        }
        return api;
      }
      window.__conflictTables = tables;
      window.supabase = {
        createClient() {
          const session = { access_token: 'test', user: { id: 'user-a', email: 'learner@example.test' } };
          return {
            auth: {
              getSession: () => Promise.resolve({ data: { session }, error: null }),
              getUser: () => Promise.resolve({ data: { user: session.user }, error: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
            },
            from: builder
          };
        }
      };
    })();
  `;
  await page.route(sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
}

test('newer account session is surfaced and can be selected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await installConflictMock(page);
  const pending = pendingRecord();
  await page.addInitScript((record) => {
    localStorage.setItem('free-htl-cloud-sync-v1', JSON.stringify({
      userId: 'user-a', mode: 'account-only', decidedAt: '2026-08-01T00:00:00.000Z'
    }));
    localStorage.setItem('free-htl-cloud-pending-v1:user-a', JSON.stringify({
      record, savedAt: '2026-08-01T07:00:00.000Z', reason: 'save'
    }));
  }, pending);

  await page.goto('/my-progress.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'conflict');
  await expect(page.locator('[data-cloud-conflict]')).toBeVisible();
  await expect(page.locator('[data-cloud-conflict-summary]')).toContainText('newer unfinished mock exam');

  await page.getByRole('button', { name: 'Continue newer account session' }).click();
  await expect(page.locator('[data-cloud-conflict]')).toBeHidden();
  await expect(page.locator('[data-progress-status]')).toContainText('newer account session is ready');
  expect(await page.evaluate(() => localStorage.getItem('free-htl-cloud-pending-v1:user-a'))).toBeNull();
  const snapshot = await page.evaluate(() => window.FreeHTLProgress.getSnapshot());
  expect(snapshot.activeSessions['mock-exam'].attemptId).toBe('remote-session');
  expect(snapshot.activeSessions['mock-exam'].currentIndex).toBe(15);
});
