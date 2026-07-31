(() => {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function domainScores(snapshot) {
    const values = {};
    const attempts = [
      ...(snapshot?.mockExamAttempts || []),
      ...(snapshot?.targetedPracticeAttempts || [])
    ];
    attempts.forEach((attempt) => {
      (attempt.domains || []).forEach((item) => {
        const percent = Number(item.percent);
        const correct = Number(item.correct);
        const total = Number(item.total);
        if (!Number.isFinite(percent) && !(Number.isFinite(correct) && Number.isFinite(total) && total > 0)) return;
        values[item.domain] ||= { attempts: 0, correct: 0, total: 0, fallbackPercents: [], latest: null };
        const value = values[item.domain];
        value.attempts += 1;
        if (value.latest === null && Number.isFinite(percent)) value.latest = percent;
        if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
          value.correct += correct;
          value.total += total;
        } else if (Number.isFinite(percent)) {
          value.fallbackPercents.push(percent);
        }
      });
    });
    return Object.entries(values).map(([domain, value]) => {
      const fallbackAverage = value.fallbackPercents.length
        ? value.fallbackPercents.reduce((sum, score) => sum + score, 0) / value.fallbackPercents.length
        : 0;
      const average = value.total > 0 ? (value.correct / value.total) * 100 : fallbackAverage;
      return {
        domain,
        attempts: value.attempts,
        average: Math.round(average),
        latest: value.latest
      };
    }).sort((left, right) => left.average - right.average || left.domain.localeCompare(right.domain));
  }

  function weakDomains(snapshot, allowedDomains) {
    const allowed = new Set(allowedDomains);
    return domainScores(snapshot)
      .filter((item) => allowed.has(item.domain))
      .slice(0, 2)
      .map((item) => item.domain);
  }

  function missedQuestionIds(snapshot) {
    const missed = new Set();
    const attempts = [
      ...(snapshot?.mockExamAttempts || []),
      ...(snapshot?.targetedPracticeAttempts || [])
    ];
    attempts.forEach((attempt) => {
      (attempt.questionResults || []).forEach((item) => {
        if (!item.correct && item.questionId) missed.add(item.questionId);
      });
    });
    return missed;
  }

  function flaggedQuestionIds(snapshot) {
    const flagged = new Set();
    const attempts = [
      ...(snapshot?.mockExamAttempts || []),
      ...(snapshot?.targetedPracticeAttempts || [])
    ];
    attempts.forEach((attempt) => {
      (attempt.questionResults || []).forEach((item) => {
        if (item.flagged && item.questionId) flagged.add(item.questionId);
      });
    });
    return flagged;
  }

  function resolvePool(bank, setup, snapshot, config) {
    if (!setup.domains.length) throw new Error('Choose at least one exam domain.');
    if (!setup.difficulties.length) throw new Error('Choose at least one difficulty level.');

    let domains = [...setup.domains];
    if (setup.sourceMode === 'weak') {
      domains = weakDomains(snapshot, setup.domains);
      if (!domains.length) throw new Error('Complete a mock exam or targeted practice set before using weak-domain practice.');
    }

    const domainSet = new Set(domains);
    const difficultySet = new Set(setup.difficulties);
    let pool = bank.questions.filter((question) => domainSet.has(question.domain) && difficultySet.has(question.difficulty));

    if (setup.sourceMode === 'missed') {
      const missed = missedQuestionIds(snapshot);
      if (!missed.size) throw new Error('No previously missed questions are stored yet.');
      pool = pool.filter((question) => missed.has(question.id));
    }

    if (setup.sourceMode === 'flagged') {
      const flagged = flaggedQuestionIds(snapshot);
      if (!flagged.size) throw new Error('No flagged questions are stored yet.');
      pool = pool.filter((question) => flagged.has(question.id));
    }

    return { pool, domains };
  }

  function createAttempt(bank, setup, snapshot, config) {
    const count = Number(setup.count);
    const { pool, domains } = resolvePool(bank, setup, snapshot, config);
    if (pool.length < count) {
      throw new Error(`Only ${pool.length} matching questions are available. Choose a smaller set or broaden the filters.`);
    }
    return {
      version: 1,
      attemptId: uid(),
      practiceId: config.practiceId,
      mode: setup.mode,
      sourceMode: setup.sourceMode,
      selectedDomains: domains,
      selectedDifficulties: [...setup.difficulties],
      requestedCount: count,
      startedAt: Date.now(),
      currentIndex: 0,
      questionIds: shuffle(pool).slice(0, count).map((question) => question.id),
      responses: {},
      flags: [],
      checked: [],
      completed: false
    };
  }

  function hydrateAttempt(value, bank, config) {
    if (!value || value.practiceId !== config.practiceId || value.completed) return null;
    const byId = new Map(bank.questions.map((question) => [question.id, question]));
    const questionIds = Array.isArray(value.questionIds) ? value.questionIds.filter((id) => byId.has(id)) : [];
    if (!questionIds.length) return null;
    return {
      version: 1,
      attemptId: value.attemptId || uid(),
      practiceId: config.practiceId,
      mode: value.mode === 'exam' ? 'exam' : 'study',
      sourceMode: value.sourceMode || 'custom',
      selectedDomains: Array.isArray(value.selectedDomains) ? [...value.selectedDomains] : [],
      selectedDifficulties: Array.isArray(value.selectedDifficulties) ? [...value.selectedDifficulties] : [],
      requestedCount: Number(value.requestedCount || questionIds.length),
      startedAt: Number(value.startedAt || Date.now()),
      currentIndex: Math.max(0, Math.min(Number(value.currentIndex || 0), questionIds.length - 1)),
      questionIds,
      responses: value.responses && typeof value.responses === 'object' ? clone(value.responses) : {},
      flags: Array.isArray(value.flags) ? [...value.flags] : [],
      checked: Array.isArray(value.checked) ? [...value.checked] : [],
      completed: false
    };
  }

  function stateDetail(attempt) {
    if (!attempt) return { cleared: true };
    return {
      attemptId: attempt.attemptId,
      practiceId: attempt.practiceId,
      mode: attempt.mode,
      sourceMode: attempt.sourceMode,
      selectedDomains: [...attempt.selectedDomains],
      selectedDifficulties: [...attempt.selectedDifficulties],
      requestedCount: attempt.requestedCount,
      startedAt: attempt.startedAt,
      currentIndex: attempt.currentIndex,
      questionIds: [...attempt.questionIds],
      responses: { ...attempt.responses },
      flags: [...attempt.flags],
      checked: [...attempt.checked]
    };
  }

  function dispatchState(attempt) {
    window.dispatchEvent(new CustomEvent('htl:targeted-state', { detail: stateDetail(attempt) }));
  }

  window.FreeHTLTargetedState = {
    createAttempt,
    hydrateAttempt,
    dispatchState,
    domainScores,
    weakDomains,
    missedQuestionIds,
    flaggedQuestionIds,
    resolvePool
  };
})();
