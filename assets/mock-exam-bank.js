(() => {
  'use strict';
  const api = window.FreeHTLMockExamBank = window.FreeHTLMockExamBank || {};
  api.cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  api.fetchJson = async (path, optional = false) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return response.json();
  };
})();
