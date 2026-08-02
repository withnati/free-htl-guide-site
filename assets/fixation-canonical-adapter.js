((root, factory) => {
  const api = factory(root.FreeHTLQuestionRuntime);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FreeHTLFixationCanonicalAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (runtime) => {
  'use strict';

  function assertRuntime() {
    if (!runtime) throw new Error('FreeHTLQuestionRuntime is required.');
  }

  function toLegacyModel(question) {
    return {
      id: question.id,
      version: question.version,
      stem: question.stem,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
      correctOptionId: question.correct_option_id,
      rationale: question.rationale,
      domain: question.domain,
      topic: question.topic,
      difficulty: question.difficulty,
      cognitiveLevel: question.cognitive_level,
    };
  }

  function createPilotSession(bank, seed = 'fixation-v3') {
    assertRuntime();
    return runtime.createSession(bank, {
      accessScope: 'sample',
      sessionType: 'module_quiz',
      count: bank.filter((question) => question.status === 'approved' && question.access === 'sample').length,
      domains: ['fixation'],
      seed,
      shuffleOptions: false,
    });
  }

  function renderIntoForm(form, session) {
    if (!form) throw new Error('Quiz form is required.');
    form.replaceChildren();
    session.questions.forEach((question, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.dataset.questionId = question.id;
      fieldset.dataset.questionVersion = String(question.version);

      const legend = document.createElement('legend');
      legend.textContent = `${index + 1}. ${question.stem}`;
      fieldset.appendChild(legend);

      question.options.forEach((option) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q${index + 1}`;
        input.value = option.id;
        label.append(input, ` ${option.text}`);
        fieldset.appendChild(label);
      });

      const explanation = document.createElement('p');
      explanation.className = 'explanation';
      explanation.hidden = true;
      fieldset.appendChild(explanation);
      form.appendChild(fieldset);
    });
  }

  function collectSubmission(form) {
    return [...form.querySelectorAll('fieldset[data-question-id]')].map((fieldset) => {
      const selected = fieldset.querySelector('input[type="radio"]:checked');
      return {
        questionId: fieldset.dataset.questionId,
        questionVersion: Number(fieldset.dataset.questionVersion),
        selectedOptionId: selected?.value || null,
      };
    });
  }

  function gradeForm(bank, form) {
    assertRuntime();
    return collectSubmission(form).map((submission) => {
      if (!submission.selectedOptionId) {
        const question = bank.find((item) => item.id === submission.questionId && item.version === submission.questionVersion);
        if (!question) throw new Error(`Question ${submission.questionId} version ${submission.questionVersion} was not found.`);
        return {
          ...submission,
          correct: false,
          omitted: true,
          domain: question.domain,
          topic: question.topic,
          difficulty: question.difficulty,
        };
      }
      return {
        ...runtime.gradeSubmission(bank, submission),
        omitted: false,
      };
    });
  }

  function toProgressAttempt(results, options = {}) {
    if (!Array.isArray(results) || !results.length) throw new Error('At least one graded result is required.');
    const score = results.filter((result) => result.correct).length;
    const total = results.length;
    const percent = Math.round((score / total) * 100);
    return {
      page: options.page || 'fixation-v3',
      quizId: options.quizId || 'fixQuiz',
      attemptId: options.attemptId || null,
      completedAt: options.completedAt || null,
      score,
      total,
      percent,
      targetMet: percent >= 80,
      questionResults: results.map((result) => ({
        questionId: result.questionId,
        questionVersion: result.questionVersion,
        moduleId: options.page || 'fixation-v3',
        domain: result.domain || 'fixation',
        topic: result.topic || null,
        difficulty: result.difficulty || null,
        selectedOptionId: result.selectedOptionId || null,
        correct: Boolean(result.correct),
        omitted: Boolean(result.omitted),
        flagged: false,
      })),
    };
  }

  return Object.freeze({
    collectSubmission,
    createPilotSession,
    gradeForm,
    renderIntoForm,
    toLegacyModel,
    toProgressAttempt,
  });
});
