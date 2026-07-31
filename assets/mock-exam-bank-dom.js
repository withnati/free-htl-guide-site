(() => {
  'use strict';
  const api = window.FreeHTLMockExamBank;
  api.fetchModulePage = async (path) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
  };
})();
