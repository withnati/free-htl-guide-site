(() => {
  'use strict';
  const state = window.FreeHTLMockExamState;
  const ui = window.FreeHTLMockExamUI;
  const results = window.FreeHTLMockExamResults;
  let bank = null;
  let attempt = null;
  let timerId = null;

  function save() {
    if (attempt && !attempt.completed) state.saveAttempt(attempt);
  }

  function updateTimer() {
    if (!attempt || attempt.mode !== 'timed') return;
    const remaining = Math.max(0, attempt.expiresAt - Date.now());
    ui.refs.timer.textContent = state.formatDuration(remaining);
    ui.refs.timerBox.classList.toggle('urgent', remaining <= 5 * 60000);
    if (remaining <= 0) finish(true);
  }

  function beginTimer() {
    window.clearInterval(timerId);
    updateTimer();
    if (attempt?.mode === 'timed') timerId = window.setInterval(updateTimer, 1000);
  }

  function present() {
    ui.mountAttempt(attempt);
    ui.renderCurrent(attempt);
    beginTimer();
    save();
    window.location.hash = 'exam';
  }

  function start(mode) {
    attempt = state.createAttempt(bank, mode);
    present();
  }

  function resume() {
    const saved = state.loadAttempt(bank.blueprint.examId);
    if (!saved) return false;
    attempt = saved;
    present();
    return true;
  }

  function move(index) {
    if (!attempt) return;
    attempt.currentIndex = Math.max(0, Math.min(attempt.questions.length - 1, index));
    ui.renderCurrent(attempt);
    save();
  }

  function respond(input) {
    if (!attempt) return;
    const fieldset = input.closest('fieldset[data-exam-question-id]');
    if (!fieldset) return;
    attempt.responses[fieldset.dataset.examQuestionId] = input.value;
    ui.renderCurrent(attempt);
    save();
  }

  function toggleFlag() {
    if (!attempt) return;
    const id = attempt.questions[attempt.currentIndex].id;
    attempt.flags = attempt.flags.includes(id) ? attempt.flags.filter((item) => item !== id) : [...attempt.flags, id];
    ui.renderCurrent(attempt);
    save();
  }

  function firstUnanswered() {
    if (!attempt) return;
    const index = attempt.questions.findIndex((question) => !attempt.responses[question.id]);
    if (index >= 0) move(index);
  }

  function unansweredCount() {
    return attempt ? attempt.questions.filter((question) => !attempt.responses[question.id]).length : 0;
  }

  function finish(timeExpired = false) {
    if (!attempt || attempt.completed) return;
    window.clearInterval(timerId);
    ui.$('[data-mock-grade-bridge]')?.click();
    const completedAt = Date.now();
    const summary = results.summarize(attempt, bank.blueprint);
    attempt.completed = true;
    const entry = {
      completedAt,
      mode: attempt.mode,
      score: summary.score,
      total: summary.total,
      percent: summary.percent,
      timeUsedMs: completedAt - attempt.startedAt,
      timeExpired
    };
    state.addHistory(entry, bank.blueprint.historyLimit);
    state.clearAttempt();
    results.render(summary, attempt, completedAt);
    ui.renderHistory(state.history(), state.formatDuration);
  }

  function reset() {
    window.clearInterval(timerId);
    state.clearAttempt();
    attempt = null;
    ui.refs.exam.hidden = true;
    ui.refs.results.hidden = true;
    ui.refs.setup.hidden = false;
    ui.refs.warning.hidden = true;
    window.dispatchEvent(new CustomEvent('htl:quiz-reset', { detail: { page: 'mock-exam', quizId: bank.blueprint.examId } }));
    window.location.hash = 'setup';
  }

  function clearHistory() {
    state.clearHistory();
    ui.renderHistory([], state.formatDuration);
  }

  function setBank(value) {
    bank = value;
    ui.renderBank(bank);
    ui.renderHistory(state.history(), state.formatDuration);
    const saved = state.loadAttempt(bank.blueprint.examId);
    ui.refs.resume.hidden = !saved;
    if (saved?.mode === 'timed' && saved.expiresAt <= Date.now()) {
      state.clearAttempt();
      ui.refs.resume.hidden = true;
      ui.refs.status.textContent = `${bank.originalCount} questions ready · previous timed attempt expired`;
    }
  }

  window.FreeHTLMockExamController = {
    setBank, start, resume, move, respond, toggleFlag, firstUnanswered,
    unansweredCount, finish, reset, clearHistory,
    getAttempt: () => attempt,
    getBank: () => bank
  };
})();
