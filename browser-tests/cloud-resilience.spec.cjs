const { test, expect } = require('@playwright/test');

const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';

async function installCloudMock(page) {
  const script = `
    (() => {
      const tables = {
        profiles: [{ user_id: 'user-a', display_name: 'Learner A', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z' }]
      };
      window.__cloudWriteFailure = false;
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
          if (operation !== 'select' && window.__cloudWriteFailure) {
            return { data: null, error: { message: 'Failed to fetch cloud progress' } };
          }
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

test('failed cloud write is retained and clears after retry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await installCloudMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('free-htl-cloud-sync-v1', JSON.stringify({
      userId: 'user-a',
      mode: 'account-only',
      decidedAt: '2026-08-01T00:00:00.000Z'
    }));
  });
  await page.goto('/modules/fixation-guide-v3.html');
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'connected');

  await page.evaluate(() => {
    window.__cloudWriteFailure = true;
    window.dispatchEvent(new CustomEvent('htl:module-section', {
      detail: { page: 'fixation-v3', sectionId: 'offline-pending', occurredAt: '2026-08-01T04:00:00.000Z' }
    }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'offline');
  await expect(page.locator('[data-cloud-sync-indicator]')).toContainText('Offline');
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('free-htl-cloud-pending-v1:user-a') || 'null'));
  expect(pending.record.modules['fixation-v3'].sectionsViewed).toContain('offline-pending');

  await page.evaluate(() => {
    window.__cloudWriteFailure = false;
    window.dispatchEvent(new CustomEvent('htl:module-section', {
      detail: { page: 'fixation-v3', sectionId: 'retry-saved', occurredAt: '2026-08-01T04:01:00.000Z' }
    }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-cloud-progress', 'saved');
  await expect(page.locator('[data-cloud-sync-indicator]')).toContainText('Saved to your account');
  expect(await page.evaluate(() => localStorage.getItem('free-htl-cloud-pending-v1:user-a'))).toBeNull();
});
