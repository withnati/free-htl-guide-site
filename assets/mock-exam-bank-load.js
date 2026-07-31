(() => {
  'use strict';
  const api = window.FreeHTLMockExamBank;
  api.load = async () => {
    const [blueprint, authority] = await Promise.all([
      api.fetchJson('data/mock-exam-blueprint.json'),
      api.fetchJson('data/module-authority.json')
    ]);
    const groups = await Promise.all(
      blueprint.sourceModules.map((source) => api.loadModuleQuestions(source, authority))
    );
    const questions = groups.flat();
    if (questions.length < blueprint.minimumQuestionBankSize) {
      throw new Error(`Expected at least ${blueprint.minimumQuestionBankSize} reviewed questions; found ${questions.length}.`);
    }
    return { blueprint, authority, originalCount: questions.length, questions };
  };
})();
