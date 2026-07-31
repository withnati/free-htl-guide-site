(() => {
  'use strict';
  const ACTIVE_KEY = 'free-htl-mock-active-v1';
  const HISTORY_KEY = 'free-htl-mock-history-v1';

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function createAttempt(bank, mode) {
    const selected = [];
    bank.blueprint.blueprint.forEach((domain) => {
      Object.entries(domain.moduleTargets).forEach(([moduleId, count]) => {
        const pool = bank.questions.filter((question) => question.moduleId === moduleId);
        if (pool.length < count) throw new Error(`Not enough questions for ${moduleId}.`);
        selected.push(...shuffle(pool).slice(0, count));
      });
    });
    const startedAt = Date.now();
    return {
      version: 1,
      examId: bank.blueprint.examId,
      mode,
      startedAt,
      expiresAt: mode === 'timed' ? startedAt + bank.blueprint.practiceTimeMinutes * 60000 : null,
      currentIndex: 0,
      questions: shuffle(selected),
      responses: {},
      flags: [],
      completed: false
    };
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  function saveAttempt(attempt) {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(attempt));
  }

  function loadAttempt(examId) {
    const attempt = read(ACTIVE_KEY, null);
    return attempt?.examId === examId && !attempt.completed ? attempt : null;
  }

  function clearAttempt() {
    localStorage.removeItem(ACTIVE_KEY);
  }

  function history() {
    const value = read(HISTORY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function addHistory(entry, limit) {
    const entries = [entry, ...history()].slice(0, limit);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    return entries;
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  window.FreeHTLMockExamState = {
    createAttempt,
    saveAttempt,
    loadAttempt,
    clearAttempt,
    history,
    addHistory,
    clearHistory,
    formatDuration
  };
})();
