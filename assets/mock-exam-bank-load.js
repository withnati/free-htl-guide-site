(() => {
  'use strict';
  const api = window.FreeHTLMockExamBank;

  function variantQuestion(item, sourceQuestion) {
    if (!sourceQuestion) throw new Error(`Unknown source question ${item.sourceQuestionId}.`);
    const template = document.createElement('template');
    template.innerHTML = sourceQuestion.fieldsetHtml.trim();
    const fieldset = template.content.firstElementChild;
    const legend = fieldset.querySelector('legend');
    if (legend) legend.textContent = item.stem;
    if (item.explanation) fieldset.dataset.expl = item.explanation;

    return {
      id: item.id,
      moduleId: sourceQuestion.moduleId,
      moduleTitle: sourceQuestion.moduleTitle,
      sourcePath: sourceQuestion.sourcePath,
      domain: sourceQuestion.domain,
      difficulty: item.difficulty || sourceQuestion.difficulty,
      fieldsetHtml: fieldset.outerHTML,
      variantOf: sourceQuestion.id
    };
  }

  api.load = async () => {
    const [blueprint, authority] = await Promise.all([
      api.fetchJson('data/mock-exam-blueprint.json'),
      api.fetchJson('data/module-authority.json')
    ]);

    const groups = await Promise.all(
      blueprint.sourceModules.map((source) => api.loadModuleQuestions(source, authority))
    );
    const moduleQuestions = groups.flat();

    const extensionManifest = await api.fetchJson(blueprint.extensionBankPath, true);
    let variantQuestions = [];
    if (extensionManifest) {
      const parts = await Promise.all(
        extensionManifest.parts.map((path) => api.fetchJson(path))
      );
      const records = parts.flatMap((part) => part.variants || []);
      if (records.length !== extensionManifest.questionCount) {
        throw new Error(`Expected ${extensionManifest.questionCount} variants; found ${records.length}.`);
      }
      const sourceById = new Map(moduleQuestions.map((question) => [question.id, question]));
      variantQuestions = records.map((item) => variantQuestion(item, sourceById.get(item.sourceQuestionId)));
    }

    const questions = [...moduleQuestions, ...variantQuestions];
    if (questions.length < blueprint.minimumQuestionBankSize) {
      throw new Error(`Expected at least ${blueprint.minimumQuestionBankSize} reviewed questions; found ${questions.length}.`);
    }
    if (new Set(questions.map((question) => question.id)).size !== questions.length) {
      throw new Error('Question IDs must be unique across the full bank.');
    }

    return {
      blueprint,
      authority,
      moduleQuestionCount: moduleQuestions.length,
      variantQuestionCount: variantQuestions.length,
      originalCount: questions.length,
      questions
    };
  };
})();
