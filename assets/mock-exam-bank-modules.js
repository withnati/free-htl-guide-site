(() => {
  'use strict';
  const api = window.FreeHTLMockExamBank;
  api.loadModuleQuestions = async (source, authority) => {
    const page = await api.fetchModulePage(source.path);
    const levels = authority?.modules?.[source.id]?.questionDifficulties || [];
    return [...page.querySelectorAll('#quiz fieldset')].map((fieldset, index) => ({
      id: `${source.id}-${index + 1}`,
      moduleId: source.id,
      moduleTitle: authority?.modules?.[source.id]?.title || source.id,
      sourcePath: source.path,
      domain: source.domain,
      difficulty: levels[index] || 'Application',
      fieldsetHtml: fieldset.outerHTML
    }));
  };
})();
