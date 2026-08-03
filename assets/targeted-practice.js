(() => {
  'use strict';

  const bankApi = window.FreeHTLMockExamBank;
  const stateApi = window.FreeHTLTargetedState;
  const progress = window.FreeHTLProgress;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const refs = {
    setup: $('#setup'), setupForm: $('#targetedSetupForm'), status: $('[data-practice-status]'),
    error: $('[data-practice-error]'), pool: $('[data-pool-count]'), start: $('[data-start-practice]'),
    resume: $('[data-resume-practice]'), workspace: $('#practiceWorkspace'), position: $('[data-practice-position]'),
    answered: $('[data-practice-answered]'), flagged: $('[data-practice-flagged]'), progress: $('[data-practice-progress]'),
    grid: $('[data-practice-grid]'), domain: $('[data-practice-domain]'), difficulty: $('[data-practice-difficulty]'),
    source: $('[data-practice-source]'), flag: $('[data-practice-flag]'), form: $('#targetedQuestionForm'),
    mount: $('[data-question-mount]'), previous: $('[data-practice-previous]'), check: $('[data-check-answer]'),
    next: $('[data-practice-next]'), submit: $('[data-submit-practice]'), warning: $('[data-practice-warning]'),
    warningCount: $('[data-practice-unanswered]'), submitAnyway: $('[data-submit-practice-anyway]'),
    inlineStatus: $('[data-question-status]'), results: $('#practiceResults'), resultDate: $('[data-practice-result-date]'),
    resultPercent: $('[data-practice-result-percent]'), resultScore: $('[data-practice-result-score]'),
    resultHeading: $('[data-practice-result-heading]'), resultSummary: $('[data-practice-result-summary]'),
    resultDomains: $('[data-practice-domain-results]'), review: $('[data-practice-review]'),
    newPractice: $('[data-new-practice]'), historyEmpty: $('[data-practice-history-empty]'),
    historyWrap: $('[data-practice-history-wrap]'), historyBody: $('[data-practice-history-body]')
  };

  let bank = null;
  let config = null;
  let snapshot = null;
  let attempt = null;
  let questionById = new Map();
  let saveQueue = Promise.resolve();

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const setupValue = (name) => refs.setupForm.elements[name]?.value || '';
  const checkedValues = (name) => $$(`input[name="${name}"]:checked`, refs.setupForm).map((input) => input.value);
  const selectedSetup = () => ({
    sourceMode: setupValue('sourceMode') || 'custom', mode: setupValue('practiceMode') || 'study',
    count: Number(setupValue('questionCount') || 10), domains: checkedValues('domains'),
    difficulties: checkedValues('difficulties')
  });

  function questionInfo(question) {
    const template = document.createElement('template');
    template.innerHTML = question.fieldsetHtml.trim();
    const fieldset = template.content.firstElementChild;
    return { fieldset, correct: fieldset?.dataset.correct || '', explanation: fieldset?.dataset.expl || '' };
  }

  function gradeQuestion(question, selectedOptionId) {
    const info = questionInfo(question);
    return { correctOptionId: info.correct, explanation: info.explanation, correct: Boolean(selectedOptionId && selectedOptionId === info.correct) };
  }

  function questionResult(question) {
    const selectedOptionId = attempt.responses[question.id] || null;
    const grade = gradeQuestion(question, selectedOptionId);
    return {
      questionId: question.id, sourceQuestionId: question.variantOf || question.id, moduleId: question.moduleId,
      domain: question.domain, difficulty: question.difficulty, selectedOptionId, correct: grade.correct,
      flagged: attempt.flags.includes(question.id)
    };
  }

  async function saveAttempt() {
    if (!attempt) return;
    const detail = {
      attemptId: attempt.attemptId, practiceId: attempt.practiceId, mode: attempt.mode, sourceMode: attempt.sourceMode,
      selectedDomains: [...attempt.selectedDomains], selectedDifficulties: [...attempt.selectedDifficulties],
      requestedCount: attempt.requestedCount, startedAt: attempt.startedAt, currentIndex: attempt.currentIndex,
      questionIds: [...attempt.questionIds], responses: { ...attempt.responses }, flags: [...attempt.flags], checked: [...attempt.checked]
    };
    saveQueue = saveQueue.catch(() => {}).then(() => {
      if (typeof progress?.recordTargetedPracticeSession === 'function') return progress.recordTargetedPracticeSession(detail);
      stateApi.dispatchState(detail);
      return undefined;
    });
    await saveQueue;
  }

  const currentQuestion = () => questionById.get(attempt.questionIds[attempt.currentIndex]);

  function updateCounts() {
    const total = attempt.questionIds.length;
    const answered = attempt.questionIds.filter((id) => Boolean(attempt.responses[id])).length;
    refs.position.textContent = `${attempt.currentIndex + 1} of ${total}`;
    refs.answered.textContent = String(answered);
    refs.flagged.textContent = String(attempt.flags.length);
    refs.progress.style.width = `${((attempt.currentIndex + 1) / total) * 100}%`;
  }

  function renderGrid() {
    refs.grid.innerHTML = '';
    attempt.questionIds.forEach((id, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'practice-grid-button'; button.textContent = String(index + 1);
      button.setAttribute('aria-label', `Question ${index + 1}`);
      if (attempt.responses[id]) button.classList.add('answered');
      if (attempt.flags.includes(id)) button.classList.add('flagged');
      if (attempt.checked.includes(id)) button.classList.add('checked');
      if (index === attempt.currentIndex) { button.classList.add('current'); button.setAttribute('aria-current', 'step'); }
      button.addEventListener('click', async () => { attempt.currentIndex = index; await saveAttempt(); renderQuestion(true); });
      refs.grid.appendChild(button);
    });
  }

  function prepareFieldset(question) {
    const { fieldset, correct, explanation } = questionInfo(question);
    if (!fieldset) throw new Error(`Question ${question.id} could not be rendered.`);
    fieldset.classList.remove('correct', 'incorrect');
    fieldset.dataset.targetedQuestionId = question.id;
    $$('input[type="radio"]', fieldset).forEach((input, index) => {
      const oldId = input.id;
      const nextId = `targeted-${question.id}-${index}`;
      input.id = nextId; input.name = `targeted-${question.id}`;
      const label = oldId ? $(`label[for="${CSS.escape(oldId)}"]`, fieldset) : null;
      if (label) label.htmlFor = nextId;
      input.checked = attempt.responses[question.id] === input.value;
      input.disabled = attempt.mode === 'study' && attempt.checked.includes(question.id);
      input.addEventListener('change', async () => {
        attempt.responses[question.id] = input.value;
        refs.inlineStatus.textContent = 'Answer saved.';
        await saveAttempt(); updateCounts(); renderGrid();
      });
    });
    let explanationNode = $('.explanation', fieldset);
    if (!explanationNode) { explanationNode = document.createElement('p'); explanationNode.className = 'explanation'; fieldset.appendChild(explanationNode); }
    const checked = attempt.mode === 'study' && attempt.checked.includes(question.id);
    if (checked) {
      const selected = attempt.responses[question.id] || null;
      const isCorrect = selected === correct;
      fieldset.classList.add(isCorrect ? 'correct' : 'incorrect');
      explanationNode.hidden = false;
      explanationNode.textContent = `${isCorrect ? 'Correct.' : 'Review:'} ${explanation}`;
    } else { explanationNode.hidden = true; explanationNode.textContent = ''; }
    return fieldset;
  }

  function renderQuestion(focus = false) {
    const question = currentQuestion();
    if (!question) return;
    refs.domain.textContent = question.domain; refs.difficulty.textContent = question.difficulty; refs.source.textContent = question.moduleTitle;
    refs.flag.setAttribute('aria-pressed', String(attempt.flags.includes(question.id)));
    refs.flag.textContent = attempt.flags.includes(question.id) ? '★ Flagged' : '☆ Flag for review';
    refs.mount.replaceChildren(prepareFieldset(question));
    refs.previous.disabled = attempt.currentIndex === 0; refs.next.disabled = attempt.currentIndex === attempt.questionIds.length - 1;
    refs.check.hidden = attempt.mode !== 'study' || attempt.checked.includes(question.id);
    refs.inlineStatus.textContent = attempt.mode === 'study' && attempt.checked.includes(question.id)
      ? 'Feedback shown. Continue when ready.' : 'Your answer is saved automatically.';
    refs.warning.hidden = true; updateCounts(); renderGrid();
    if (focus) { const legend = $('legend', refs.mount); if (legend) { legend.id = 'targetedQuestionHeading'; legend.tabIndex = -1; legend.focus(); } }
  }

  async function move(offset) {
    const next = Math.max(0, Math.min(attempt.questionIds.length - 1, attempt.currentIndex + offset));
    if (next === attempt.currentIndex) return;
    attempt.currentIndex = next; await saveAttempt(); renderQuestion(true);
  }

  async function checkAnswer() {
    const question = currentQuestion();
    if (!attempt.responses[question.id]) { refs.inlineStatus.textContent = 'Choose an answer before checking it.'; refs.inlineStatus.focus(); return; }
    if (!attempt.checked.includes(question.id)) attempt.checked.push(question.id);
    await saveAttempt(); renderQuestion(); refs.inlineStatus.focus();
  }

  function summarize() {
    const results = attempt.questionIds.map((id) => questionResult(questionById.get(id)));
    const score = results.filter((item) => item.correct).length;
    const total = results.length; const percent = total ? Math.round((score / total) * 100) : 0;
    const domains = config.domains.map((domain) => {
      const items = results.filter((item) => item.domain === domain);
      const correct = items.filter((item) => item.correct).length;
      return { domain, correct, total: items.length, percent: items.length ? Math.round((correct / items.length) * 100) : 0 };
    }).filter((item) => item.total);
    return { score, total, percent, domains, questionResults: results };
  }

  function resultInterpretation(percent) {
    if (percent >= config.studyTargetPercent) return ['Study target met', 'Repeat with a different filter or practice the lowest domain shown below.'];
    if (percent >= 65) return ['Developing performance', 'Review missed questions, then build another focused set in the lowest domain.'];
    return ['Focused review recommended', 'Return to the source lessons and use Study mode before another exam-style set.'];
  }

  function reviewFieldset(question, result) {
    const { fieldset, correct, explanation } = questionInfo(question);
    fieldset.classList.remove('correct', 'incorrect'); fieldset.classList.add(result.correct ? 'correct' : 'incorrect');
    $$('input[type="radio"]', fieldset).forEach((input, index) => {
      input.id = `review-${question.id}-${index}`; input.name = `review-${question.id}`;
      input.checked = result.selectedOptionId === input.value; input.disabled = true;
    });
    let explanationNode = $('.explanation', fieldset);
    if (!explanationNode) { explanationNode = document.createElement('p'); explanationNode.className = 'explanation'; fieldset.appendChild(explanationNode); }
    explanationNode.hidden = false;
    explanationNode.textContent = `${result.correct ? 'Correct.' : `Correct answer: ${correct}.`} ${explanation}`;
    return fieldset;
  }

  function renderResults(summary, completedAt) {
    const [heading, message] = resultInterpretation(summary.percent);
    refs.resultDate.textContent = new Date(completedAt).toLocaleString(); refs.resultPercent.textContent = `${summary.percent}%`;
    refs.resultScore.textContent = `${summary.score}/${summary.total}`; refs.resultHeading.textContent = heading; refs.resultSummary.textContent = message;
    refs.resultDomains.innerHTML = summary.domains.map((item) => `
      <article class="practice-domain-result"><strong>${escapeHtml(item.domain)}</strong><span>${item.correct}/${item.total}</span>
      <div class="practice-domain-bar"><i style="width:${item.percent}%"></i></div><small>${item.percent}%</small></article>`).join('');
    refs.review.innerHTML = '';
    summary.questionResults.forEach((result) => {
      if (result.correct && !result.flagged) return;
      const question = questionById.get(result.questionId); const article = document.createElement('article'); article.className = 'practice-review-item';
      article.innerHTML = `<p class="small muted">${escapeHtml(question.domain)} · ${escapeHtml(question.difficulty)}</p>`;
      article.appendChild(reviewFieldset(question, result));
      const link = document.createElement('a'); link.className = 'btn btn-small'; link.href = question.sourcePath; link.textContent = `Review ${question.moduleTitle}`;
      article.appendChild(link); refs.review.appendChild(article);
    });
    if (!refs.review.children.length) refs.review.innerHTML = '<div class="callout safe">No missed or flagged questions in this set.</div>';
    refs.workspace.hidden = true; refs.setup.hidden = false; refs.results.hidden = false;
    refs.results.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#practiceResultsHeading')?.focus();
  }

  async function complete(force = false) {
    const unanswered = attempt.questionIds.filter((id) => !attempt.responses[id]).length;
    if (unanswered && !force) { refs.warningCount.textContent = String(unanswered); refs.warning.hidden = false; refs.warning.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const completedAt = new Date().toISOString(); const summary = summarize();
    const detail = {
      attemptId: attempt.attemptId, practiceId: attempt.practiceId, completedAt, mode: attempt.mode, sourceMode: attempt.sourceMode,
      selectedDomains: attempt.selectedDomains, selectedDifficulties: attempt.selectedDifficulties,
      score: summary.score, total: summary.total, percent: summary.percent, domains: summary.domains,
      questionResults: summary.questionResults, startedAt: attempt.startedAt, timeUsedMs: Date.now() - attempt.startedAt
    };
    if (typeof progress?.recordTargetedPracticeAttempt === 'function') await progress.recordTargetedPracticeAttempt(detail);
    else window.dispatchEvent(new CustomEvent('htl:targeted-completed', { detail }));
    attempt.completed = true; stateApi.dispatchState(null); snapshot = await progress.getSnapshot();
    renderResults(summary, completedAt); renderHistory(); attempt = null; refs.resume.hidden = true;
  }

  function renderHistory() {
    const entries = snapshot?.targetedPracticeAttempts || [];
    refs.historyEmpty.hidden = Boolean(entries.length); refs.historyWrap.hidden = !entries.length;
    refs.historyBody.innerHTML = entries.slice(0, 10).map((entry) => `
      <tr><td>${escapeHtml(new Date(entry.completedAt).toLocaleDateString())}</td><td>${escapeHtml(entry.mode === 'study' ? 'Study' : 'Exam')}</td>
      <td>${escapeHtml(entry.sourceMode || 'custom')}</td><td>${entry.score}/${entry.total} (${entry.percent}%)</td></tr>`).join('');
  }

  function applyQueryDefaults() {
    const params = new URLSearchParams(window.location.search); const source = params.get('source');
    if (source && refs.setupForm.elements.sourceMode) { const input = $(`input[name="sourceMode"][value="${CSS.escape(source)}"]`, refs.setupForm); if (input) input.checked = true; }
    const domain = params.get('domain');
    if (domain) $$('input[name="domains"]', refs.setupForm).forEach((input) => { input.checked = input.value === domain; });
  }

  function updateSetupState() {
    if (!bank || !snapshot) return;
    try {
      const setup = selectedSetup(); const { pool, domains } = stateApi.resolvePool(bank, setup, snapshot, config);
      refs.pool.textContent = `${pool.length} matching questions${setup.sourceMode === 'weak' ? ` across ${domains.join(' and ')}` : ''}`;
      refs.pool.classList.remove('error-text'); refs.start.disabled = pool.length < setup.count; refs.error.hidden = true;
    } catch (error) { refs.pool.textContent = error.message; refs.pool.classList.add('error-text'); refs.start.disabled = true; }
  }

  async function startFromSetup(event) {
    event.preventDefault();
    try {
      attempt = stateApi.createAttempt(bank, selectedSetup(), snapshot, config); await saveAttempt();
      refs.setup.hidden = true; refs.results.hidden = true; refs.workspace.hidden = false; renderQuestion(true);
      refs.workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { refs.error.textContent = error.message; refs.error.hidden = false; refs.error.focus(); }
  }

  async function resumeAttempt() {
    const active = snapshot.activeSessions?.['targeted-practice']; attempt = stateApi.hydrateAttempt(active, bank, config);
    if (!attempt) { refs.resume.hidden = true; return; }
    refs.setup.hidden = true; refs.results.hidden = true; refs.workspace.hidden = false; renderQuestion(true);
    refs.workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function initialize() {
    try {
      await progress.ready;
      [config, bank, snapshot] = await Promise.all([
        bankApi.fetchJson('data/targeted-practice-config.json'), bankApi.load(), progress.getSnapshot()
      ]);
      questionById = new Map(bank.questions.map((question) => [question.id, question]));
      $('[data-targeted-bank-total]').textContent = String(bank.questions.length); refs.status.textContent = 'Ready'; refs.status.classList.add('ready');
      refs.start.disabled = false; refs.resume.hidden = !snapshot.activeSessions?.['targeted-practice']; applyQueryDefaults(); updateSetupState(); renderHistory();
      document.body.dataset.targetedPracticeReady = 'true';
    } catch (error) {
      console.error(error); refs.status.textContent = 'Unavailable'; refs.error.textContent = 'Targeted practice could not load. Refresh the page or use the module quizzes.';
      refs.error.hidden = false; document.body.dataset.targetedPracticeReady = 'error';
    }
  }

  refs.setupForm?.addEventListener('submit', (event) => { void startFromSetup(event); });
  refs.setupForm?.addEventListener('change', updateSetupState);
  refs.resume?.addEventListener('click', () => { void resumeAttempt(); });
  refs.previous?.addEventListener('click', () => { void move(-1); }); refs.next?.addEventListener('click', () => { void move(1); });
  refs.check?.addEventListener('click', () => { void checkAnswer(); }); refs.submit?.addEventListener('click', () => { void complete(false); });
  refs.submitAnyway?.addEventListener('click', () => { void complete(true); });
  refs.flag?.addEventListener('click', async () => {
    const id = currentQuestion().id;
    if (attempt.flags.includes(id)) attempt.flags = attempt.flags.filter((item) => item !== id); else attempt.flags.push(id);
    await saveAttempt(); renderQuestion();
  });
  refs.newPractice?.addEventListener('click', () => { refs.results.hidden = true; refs.setup.hidden = false; refs.setup.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  void initialize();
})();
