const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';
const decisionKey = 'free-htl-cloud-sync-v1';

async function mockSupabase(page, session) {
  const calls = [];
  await page.exposeFunction('__recordGlobalCloudCall', (call) => calls.push(call));
  const tables = {
    profiles: session?.user ? [{
      user_id: session.user.id,
      display_name: 'Learner A',
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z'
    }] : []
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
        const api = {
          select() { operation = 'select'; return api; },
          eq(key, value) { filters.push([key, value]); return api; },
          limit() { return api; },
          upsert(value, nextOptions = {}) { operation = 'upsert'; payload = Array.isArray(value) ? value : [value]; options = nextOptions; return api; },
          insert(value) { operation = 'insert'; payload = Array.isArray(value) ? value : [value]; return api; },
          update(value) { operation = 'update'; payload = value; return api; },
          delete() { operation = 'delete'; return api; },
          then(resolve, reject) { execute().then(resolve, reject); }
        };
        async function execute() {
          tables[table] ||= [];
          await window.__recordGlobalCloudCall([operation, table, clone(payload), clone(filters), clone(options)]);
          if (operation === 'select') return { data: clone(tables[table].filter((row) => matches(row, filters))), error: null };
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
      window.supabase = {
        createClient() {
          return {
            auth: {
              getSession: () => Promise.resolve({ data: { session: ${JSON.stringify(session)} }, error: null }),
              getUser: () => Promise.resolve({ data: { user: ${JSON.stringify(session?.user || null)} }, error: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
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

async function setDecision(page, mode = 'account-only') {
  await page.addInitScript(({ key, selectedMode }) => {
    localStorage.setItem(key, JSON.stringify({
      userId: 'user-a',
      mode: selectedMode,
      decidedAt: '2026-08-01T00:00:00.000Z'
    }));
  }, { key: decisionKey, selectedMode: mode });
}

test('approved account activates cloud storage on a lesson page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  const calls = await mockSupabase(page, {
    access_token: 'test',
    user: { id: 'user-a', email: 'learner@example.test' }
  });
  await setDecision(page);
  await page.goto('/modules/fixation-guide-v3.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('htl:module-section', {
      detail: { page: 'fixation-v3', sectionId: 'cloud-sync-test', occurredAt: '2026-08-01T02:00:00.000Z' }
    }));
  });
  await expect.poll(() => calls.some((call) => call[0] === 'upsert' && call[1] === 'module_progress')).toBeTruthy();
  const dashboard = await page.evaluate(() => window.FreeHTLProgress.getDashboard());
  expect(dashboard.account.localOnly).toBeFalsy();
  expect(dashboard.account.adapter).toBe('supabase-cloud');
});

test('signed-out learner with a saved marker remains local', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  const calls = await mockSupabase(page, null);
  await setDecision(page);
  await page.goto('/modules/fixation-guide-v3.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'signed-out');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('htl:module-section', {
      detail: { page: 'fixation-v3', sectionId: 'signed-out-local', occurredAt: '2026-08-01T03:00:00.000Z' }
    }));
  });
  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('free-htl-progress-v1') || '{}');
    return value.modules?.['fixation-v3']?.sectionsViewed?.includes('signed-out-local') || false;
  })).toBeTruthy();
  expect(calls.some((call) => call[0] === 'upsert' && call[1] === 'module_progress')).toBeFalsy();
});
