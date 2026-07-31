(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const refs = {
    setup: $('#setup'), exam: $('#exam'), results: $('#results'), form: $('#htl-mock-50'),
    status: $('[data-exam-status]'), start: $('[data-start-exam]'), resume: $('[data-resume-exam]'),
    blueprint: $('[data-blueprint-body]'), bankTotal: $('[data-bank-total]'), grid: $('[data-question-grid]'),
    position: $('[data-question-position]'), answered: $('[data-answered-count]'), flagged: $('[data-flagged-count]'),
    timer: $('[data-time-remaining]'), timerBox: $('.exam-timer'), progress: $('[data-exam-progress]'),
    mode: $('[data-exam-mode-label]'), domain: $('[data-question-domain]'), difficulty: $('[data-question-difficulty]'),
    flag: $('[data-toggle-flag]'), warning: $('[data-submit-warning]'), warningCount: $('[data-unanswered-warning]'),
    resultDate: $('[data-result-date]'), resultPercent: $('[data-result-percent]'), resultScore: $('[data-result-score]'),
    resultInterpretation: $('[data-result-interpretation]'), resultSummary: $('[data-result-summary]'),
    domainResults: $('[data-domain-results]'), review: $('[data-exam-review]'), historyBody: $('[data-history-body]'),
    historyEmpty: $('[data-history-empty]'), historyWrap: $('[data-history-wrap]')
  };

  function renderBank(bank) {
    refs.bankTotal.textContent = String(bank.originalCount);
    refs.blueprint.innerHTML = bank.blueprint.blueprint.map((item) => `
      <tr><td>${item.domain}</td><td>${item.count}</td><td>${item.percent}%</td><td>${item.officialRange}</td></tr>`).join('');
    refs.status.textContent = `${bank.originalCount} reviewed questions ready`;
    refs.start.disabled = false;
  }

  function fieldsetFrom(question, index) {
    const template = document.createElement('template');
    template.innerHTML = question.fieldsetHtml.trim();
    const fieldset = template.content.firstElementChild;
    fieldset.dataset.examQuestionId = question.id;
    fieldset.dataset.examDomain = question.domain;
    fieldset.dataset.examModule = question.moduleId;
    fieldset.hidden = true;
    const legend = $('legend', fieldset);
    if (legend) {
      legend.textContent = legend.textContent.replace(/^\s*\d+\.\s*/, '');
      legend.id = `exam-question-heading-${index}`;
      legend.tabIndex = -1;
    }
    $$('input[type="radio"]', fieldset).forEach((input) => { input.name = `exam-${question.id}`; });
    return fieldset;
  }

  function mountAttempt(attempt) {
    refs.form.innerHTML = '';
    refs.grid.innerHTML = '';
    attempt.questions.forEach((question, index) => {
      const fieldset = fieldsetFrom(question, index);
      const saved = attempt.responses[question.id];
      if (saved) fieldset.querySelector(`input[value="${CSS.escape(saved)}"]`)?.setAttribute('checked', '');
      refs.form.appendChild(fieldset);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(index + 1);
      button.dataset.questionIndex = String(index);
      button.setAttribute('aria-label', `Go to question ${index + 1}`);
      refs.grid.appendChild(button);
    });
    refs.setup.hidden = true;
    refs.results.hidden = true;
    refs.exam.hidden = false;
    refs.mode.textContent = attempt.mode === 'timed' ? 'Timed' : 'Untimed';
    refs.timerBox.hidden = attempt.mode !== 'timed';
  }

  function renderCurrent(attempt) {
    const index = attempt.currentIndex;
    const question = attempt.questions[index];
    $$('fieldset', refs.form).forEach((fieldset, itemIndex) => { fieldset.hidden = itemIndex !== index; });
    refs.exam.setAttribute('aria-labelledby', `exam-question-heading-${index}`);
    refs.position.textContent = `${index + 1} of ${attempt.questions.length}`;
    refs.answered.textContent = String(Object.keys(attempt.responses).length);
    refs.flagged.textContent = String(attempt.flags.length);
    refs.progress.style.width = `${((index + 1) / attempt.questions.length) * 100}%`;
    refs.domain.textContent = question.domain;
    refs.difficulty.textContent = question.difficulty;
    const isFlagged = attempt.flags.includes(question.id);
    refs.flag.setAttribute('aria-pressed', String(isFlagged));
    refs.flag.textContent = isFlagged ? '★ Flagged for review' : '☆ Flag for review';
    $$('[data-question-index]', refs.grid).forEach((button, itemIndex) => {
      const item = attempt.questions[itemIndex];
      button.classList.toggle('current', itemIndex === index);
      button.classList.toggle('answered', Boolean(attempt.responses[item.id]));
      button.classList.toggle('flagged', attempt.flags.includes(item.id));
      button.setAttribute('aria-current', itemIndex === index ? 'true' : 'false');
    });
    refs.warning.hidden = true;
    refs.form.querySelector('fieldset:not([hidden]) legend')?.focus();
  }

  function renderHistory(entries, formatDuration) {
    refs.historyEmpty.hidden = entries.length > 0;
    refs.historyWrap.hidden = entries.length === 0;
    refs.historyBody.innerHTML = entries.map((entry) => `
      <tr><td>${new Date(entry.completedAt).toLocaleString()}</td><td>${entry.mode}</td>
      <td>${entry.score}/${entry.total} (${entry.percent}%)</td><td>${formatDuration(entry.timeUsedMs)}</td></tr>`).join('');
  }

  window.FreeHTLMockExamUI = { $, $$, refs, renderBank, mountAttempt, renderCurrent, renderHistory };
})();
