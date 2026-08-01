const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

function browserRecord() {
  const timestamp = '2026-08-01T01:00:00.000Z';
  return {
    schemaVersion: 2,
    recordId: 'progress-browser-a',
    createdAt: timestamp,
    updatedAt: timestamp,
    owner: { kind: 'anonymous', anonymousId: 'anon-a', accountId: null },
    entitlement: { tier: 'public', status: 'preview', source: 'local-development', updatedAt: timestamp },
    modules: {
      'fixation-v3': {
        moduleId: 'fixation-v3', startedAt: timestamp, lastActivityAt: timestamp,
        lastSection: 'fixation-basics', sectionsViewed: ['fixation-basics'], completedAt: timestamp
      }
    },
    studyTasks: {},
    quizAttempts: [{
      id: 'quiz-stable-a', page: 'fixation-v3', quizId: 'fixation-quiz', score: 4,
      total: 5, percent: 80, targetMet: true, completedAt: timestamp, legacy: false
    }],
    mockExamAttempts: [],
    targetedPracticeAttempts: [],
    activeSessions: {},
    activity: [{ id: 'activity-a', type: 'quiz-completed', page: 'fixation-v3', percent: 80, occurredAt: timestamp }],
    migration: { legacyVersion: 1, completedAt: timestamp, importedRecords: 0 }
  };
}

async function mockSupabase(page, options = {}) {
  const calls = [];
  await page.exposeFunction('__recordCloudCall', (call) => calls.push(call));
  const session = options.session === undefined
    ? { access_token: 'test', user: { id: 'user-a', email: 'learner@example.test' } }
    : options.session;
  const tables = options.tables || {
    profiles: [{ user_id: 'user-a', display_name: 'Learner A', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z' }]
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
          await window.__recordCloudCall([operation, table, clone(payload), clone(filters), clone(options)]);
          if (operation === 'select') {
            let data = tables[table].filter((row) => matches(row, filters));
            if (limitValue !== null) data = data.slice(0, limitValue);
            return { data: clone(data), error: null };
          }
          if (operation === 'delete') {
            tables[table] = tables[table].filter((row) => !matches(row, filters));
            return { data: [], error: null };
          }
          if (operation === 'update') {
            tables[table].forEach((row) => { if (matches(row, filters)) Object.assign(row, clone(payload)); });
            return { data: clone(tables[table].filter((row) => matches(row, filters))), error: null };
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
              const row = clone(incoming);
              if (table === 'progress_migrations') row.migration_id ||= 'migration-a';
              tables[table].push(row);
            }
          }
          return { data: clone(payload), error: null };
        }
        return api;
      }
      window.__cloudTables = tables;
      window.supabase = {
        createClient() {
          return {
            auth: {
              getSession: () => Promise.resolve({ data: { session: ${JSON.stringify(session)} }, error: null }),
              getUser: () => Promise.resolve({ data: { user: ${JSON.stringify(session?.user || null)} }, error: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
              signOut: () => Promise.resolve({ data: {}, error: null })
            },
            from: builder
          };
        }
      };
    })();
  `;
  await page.route(sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
  return calls;
}

test('signed-out dashboard keeps progress in the browser', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, { session: null });
  await page.goto('/my-progress.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'anonymous');
  await expect(page.locator('[data-cloud-import]')).toBeHidden();
  await expect(page.locator('[data-progress-status]')).toContainText('stored in this browser');
});

test('verified learner explicitly imports browser progress into cloud tables', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const calls = await mockSupabase(page);
  const record = browserRecord();
  await page.addInitScript((value) => localStorage.setItem('free-htl-progress-v1', JSON.stringify(value)), record);
  await page.goto('/my-progress.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'awaiting-import');
  await expect(page.locator('[data-cloud-import]')).toBeVisible();
  await expect(page.locator('[data-cloud-import-summary]')).toContainText('1 module record');
  await page.getByRole('button', { name: 'Import and enable cloud sync' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');
  await expect(page.locator('[data-storage-status]')).toHaveText('Supabase cloud');
  await expect(page.locator('[data-summary-modules]')).toHaveText('1/7');
  expect(calls.some((call) => call[0] === 'upsert' && call[1] === 'progress_migrations')).toBeTruthy();
  expect(calls.some((call) => call[0] === 'upsert' && call[1] === 'module_progress')).toBeTruthy();
  expect(calls.some((call) => call[0] === 'upsert' && call[1] === 'learning_attempts')).toBeTruthy();
});

test('account-only choice leaves browser backup unchanged', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await mockSupabase(page);
  const record = browserRecord();
  await page.addInitScript((value) => localStorage.setItem('free-htl-progress-v1', JSON.stringify(value)), record);
  await page.goto('/my-progress.html');
  await page.getByRole('button', { name: 'Use account progress only' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');
  const backup = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-progress-v1')));
  expect(backup.recordId).toBe('progress-browser-a');
  expect(backup.quizAttempts).toHaveLength(1);
});

test('stable attempt IDs and module sections merge without duplication', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await mockSupabase(page, { session: null });
  await page.goto('/my-progress.html');
  const result = await page.evaluate(() => {
    const remote = {
      schemaVersion: 2, modules: { m1: { moduleId: 'm1', sectionsViewed: ['a'], lastActivityAt: '2026-08-01T00:00:00Z' } },
      studyTasks: {}, quizAttempts: [{ id: 'same', completedAt: '2026-08-01T00:00:00Z' }], mockExamAttempts: [], targetedPracticeAttempts: [], activeSessions: {}, activity: []
    };
    const local = {
      schemaVersion: 2, modules: { m1: { moduleId: 'm1', sectionsViewed: ['b'], lastActivityAt: '2026-08-01T01:00:00Z' } },
      studyTasks: {}, quizAttempts: [{ id: 'same', completedAt: '2026-08-01T00:00:00Z' }], mockExamAttempts: [], targetedPracticeAttempts: [], activeSessions: {}, activity: []
    };
    return window.FreeHTLCloudProgressAdapter.mergeRecords(remote, local, 'user-a');
  });
  expect(result.quizAttempts).toHaveLength(1);
  expect(result.modules.m1.sectionsViewed.sort()).toEqual(['a', 'b']);
});