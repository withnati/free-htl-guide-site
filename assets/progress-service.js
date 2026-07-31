(() => {
  'use strict';

  const scriptUrl = new URL(document.currentScript?.src || window.location.href);
  const accessUrl = new URL('../data/content-access.json', scriptUrl);
  const schemaUrl = new URL('../data/progress-schema.json', scriptUrl);
  const FALLBACK_STORAGE_KEY = 'free-htl-progress-v1';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => {
    const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${value}`;
  };

  class LocalProgressAdapter {
    constructor(storage, storageKey) {
      this.storage = storage;
      this.storageKey = storageKey;
      this.name = 'local-browser';
    }

    async load() {
      try {
        const value = this.storage.getItem(this.storageKey);
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    }

    async save(record) {
      this.storage.setItem(this.storageKey, JSON.stringify(record));
      return clone(record);
    }

    async clear() {
      this.storage.removeItem(this.storageKey);
    }
  }

  let schema = null;
  let access = null;
  let adapter = null;
  let record = null;
  const subscribers = new Set();

  function defaultRecord() {
    const createdAt = nowIso();
    return {
      schemaVersion: schema.schemaVersion,
      recordId: uid('progress'),
      createdAt,
      updatedAt: createdAt,
      owner: {
        kind: 'anonymous',
        anonymousId: uid('anon'),
        accountId: null
      },
      entitlement: {
        tier: 'public',
        status: 'preview',
        source: 'local-development',
        updatedAt: createdAt
      },
      modules: {},
      studyTasks: {},
      quizAttempts: [],
      mockExamAttempts: [],
      activeSessions: {},
      activity: [],
      migration: {
        legacyVersion: 0,
        completedAt: null
      }
    };
  }

  function normalizeRecord(value) {
    const base = defaultRecord();
    if (!value || typeof value !== 'object') return base;
    return {
      ...base,
      ...value,
      schemaVersion: schema.schemaVersion,
      owner: { ...base.owner, ...(value.owner || {}) },
      entitlement: { ...base.entitlement, ...(value.entitlement || {}) },
      modules: value.modules && typeof value.modules === 'object' ? value.modules : {},
      studyTasks: value.studyTasks && typeof value.studyTasks === 'object' ? value.studyTasks : {},
      quizAttempts: Array.isArray(value.quizAttempts) ? value.quizAttempts : [],
      mockExamAttempts: Array.isArray(value.mockExamAttempts) ? value.mockExamAttempts : [],
      activeSessions: value.activeSessions && typeof value.activeSessions === 'object' ? value.activeSessions : {},
      activity: Array.isArray(value.activity) ? value.activity : [],
      migration: { ...base.migration, ...(value.migration || {}) }
    };
  }

  function moduleEntry(moduleId) {
    if (!record.modules[moduleId]) {
      record.modules[moduleId] = {
        moduleId,
        startedAt: null,
        lastActivityAt: null,
        lastSection: null,
        sectionsViewed: [],
        completedAt: null
      };
    }
    return record.modules[moduleId];
  }

  function addActivity(type, detail = {}, occurredAt = nowIso()) {
    record.activity.unshift({ id: uid('activity'), type, occurredAt, ...detail });
    record.activity = record.activity.slice(0, schema.activityLimit);
  }

  function touchModule(moduleId, occurredAt = nowIso()) {
    const module = moduleEntry(moduleId);
    module.startedAt ||= occurredAt;
    module.lastActivityAt = occurredAt;
    return module;
  }

  function saveLegacySection(moduleId, sectionId, occurredAt) {
    const module = touchModule(moduleId, occurredAt);
    module.lastSection = sectionId;
    if (sectionId && !module.sectionsViewed.includes(sectionId)) module.sectionsViewed.push(sectionId);
  }

  function migrateLegacy() {
    if (record.migration.legacyVersion >= 1) return false;
    const migratedAt = nowIso();
    let imported = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(schema.legacyKeys.lastSectionPrefix)) {
        const moduleId = key.slice(schema.legacyKeys.lastSectionPrefix.length);
        const sectionId = localStorage.getItem(key);
        if (moduleId && sectionId) {
          saveLegacySection(moduleId, sectionId, migratedAt);
          imported += 1;
        }
      }
      if (key.startsWith(schema.legacyKeys.studyTaskPrefix)) {
        const remainder = key.slice(schema.legacyKeys.studyTaskPrefix.length);
        const separator = remainder.lastIndexOf(':');
        if (separator > 0) {
          const page = remainder.slice(0, separator);
          const taskId = remainder.slice(separator + 1);
          const checked = localStorage.getItem(key) === '1';
          record.studyTasks[`${page}:${taskId}`] = { page, taskId, checked, updatedAt: migratedAt };
          if (checked) touchModule(page, migratedAt);
          imported += 1;
        }
      }
    }

    const storageKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
    storageKeys.forEach((key) => {
      if (!key.startsWith(schema.legacyKeys.quizScorePrefix)) return;
      const page = key.slice(schema.legacyKeys.quizScorePrefix.length);
      const percent = Number(localStorage.getItem(key));
      if (!page || !Number.isFinite(percent)) return;
      const best = Number(localStorage.getItem(`${schema.legacyKeys.quizBestPrefix}${page}`) || percent);
      record.quizAttempts.push({
        id: uid('legacy-quiz'),
        page,
        quizId: null,
        score: null,
        total: null,
        percent,
        bestPercent: Math.max(percent, Number.isFinite(best) ? best : percent),
        targetMet: percent >= 80,
        completedAt: migratedAt,
        legacy: true
      });
      touchModule(page, migratedAt);
      imported += 1;
    });

    try {
      const history = JSON.parse(localStorage.getItem(schema.legacyKeys.mockHistory) || '[]');
      if (Array.isArray(history)) {
        history.slice(0, schema.mockAttemptLimit).forEach((entry) => {
          record.mockExamAttempts.push({
            id: uid('legacy-mock'),
            examId: 'free-htl-mock-50',
            completedAt: new Date(entry.completedAt || Date.now()).toISOString(),
            mode: entry.mode || 'unknown',
            score: Number(entry.score || 0),
            total: Number(entry.total || 50),
            percent: Number(entry.percent || 0),
            timeUsedMs: Number(entry.timeUsedMs || 0),
            timeExpired: Boolean(entry.timeExpired),
            domains: Array.isArray(entry.domains) ? entry.domains : [],
            questionResults: [],
            legacy: true
          });
          imported += 1;
        });
      }
    } catch {
      // Preserve malformed legacy history for manual recovery.
    }

    try {
      const active = JSON.parse(localStorage.getItem(schema.legacyKeys.mockActive) || 'null');
      if (active && !active.completed) {
        record.activeSessions['mock-exam'] = sanitizeActiveSession(active);
        imported += 1;
      }
    } catch {
      // Preserve malformed active state.
    }

    record.migration = { legacyVersion: 1, completedAt: migratedAt, importedRecords: imported };
    if (imported) addActivity('legacy-progress-imported', { importedRecords: imported }, migratedAt);
    return true;
  }

  function sanitizeActiveSession(value) {
    return {
      attemptId: value.attemptId || null,
      examId: value.examId || 'free-htl-mock-50',
      mode: value.mode || 'untimed',
      startedAt: value.startedAt || null,
      expiresAt: value.expiresAt || null,
      currentIndex: Number(value.currentIndex || 0),
      questionIds: Array.isArray(value.questionIds)
        ? value.questionIds
        : Array.isArray(value.questions) ? value.questions.map((question) => question.id).filter(Boolean) : [],
      responses: value.responses && typeof value.responses === 'object' ? clone(value.responses) : {},
      flags: Array.isArray(value.flags) ? [...value.flags] : [],
      updatedAt: nowIso()
    };
  }

  function sanitizeQuestionResult(item) {
    return {
      questionId: item.questionId || null,
      sourceQuestionId: item.sourceQuestionId || item.questionId || null,
      moduleId: item.moduleId || null,
      domain: item.domain || null,
      selectedOptionId: item.selectedOptionId || null,
      correct: Boolean(item.correct),
      flagged: Boolean(item.flagged)
    };
  }

  async function persist() {
    record.updatedAt = nowIso();
    await adapter.save(record);
    const snapshot = clone(record);
    subscribers.forEach((callback) => callback(snapshot));
    window.dispatchEvent(new CustomEvent('htl:progress-updated', { detail: { updatedAt: record.updatedAt } }));
    return snapshot;
  }

  async function initialize() {
    const [schemaResponse, accessResponse] = await Promise.all([fetch(schemaUrl), fetch(accessUrl)]);
    if (!schemaResponse.ok || !accessResponse.ok) throw new Error('Progress configuration could not be loaded.');
    schema = await schemaResponse.json();
    access = await accessResponse.json();
    adapter = new LocalProgressAdapter(localStorage, schema.storageKey || FALLBACK_STORAGE_KEY);
    record = normalizeRecord(await adapter.load());
    const changed = migrateLegacy();
    if (changed || !localStorage.getItem(schema.storageKey)) await persist();
    document.body?.setAttribute('data-progress-service-ready', 'true');
    return true;
  }

  const ready = initialize().catch((error) => {
    console.error(error);
    document.body?.setAttribute('data-progress-service-ready', 'error');
    throw error;
  });

  async function getSnapshot() {
    await ready;
    return clone(record);
  }

  async function recordModuleSection(detail) {
    await ready;
    if (!detail?.page || !detail?.sectionId) return getSnapshot();
    const occurredAt = detail.occurredAt || nowIso();
    const module = touchModule(detail.page, occurredAt);
    module.lastSection = detail.sectionId;
    if (!module.sectionsViewed.includes(detail.sectionId)) module.sectionsViewed.push(detail.sectionId);
    addActivity('module-section-viewed', { page: detail.page, sectionId: detail.sectionId }, occurredAt);
    return persist();
  }

  async function recordStudyTask(detail) {
    await ready;
    if (!detail?.page || !detail?.taskId) return getSnapshot();
    const occurredAt = detail.occurredAt || nowIso();
    const key = `${detail.page}:${detail.taskId}`;
    record.studyTasks[key] = {
      page: detail.page,
      taskId: detail.taskId,
      checked: Boolean(detail.checked),
      updatedAt: occurredAt
    };
    touchModule(detail.page, occurredAt);
    addActivity('study-task-updated', { page: detail.page, taskId: detail.taskId, checked: Boolean(detail.checked) }, occurredAt);
    return persist();
  }

  async function recordQuizAttempt(detail) {
    await ready;
    if (!detail?.page || !Number.isFinite(Number(detail.percent))) return getSnapshot();
    const completedAt = detail.completedAt || nowIso();
    const attempt = {
      id: detail.attemptId || uid('quiz'),
      page: detail.page,
      quizId: detail.quizId || null,
      score: Number.isFinite(Number(detail.score)) ? Number(detail.score) : null,
      total: Number.isFinite(Number(detail.total)) ? Number(detail.total) : null,
      percent: Number(detail.percent),
      targetMet: Boolean(detail.targetMet),
      completedAt,
      legacy: false
    };
    record.quizAttempts.unshift(attempt);
    record.quizAttempts = record.quizAttempts.slice(0, schema.quizAttemptLimit);
    const module = touchModule(detail.page, completedAt);
    if (attempt.targetMet && !module.completedAt) module.completedAt = completedAt;
    addActivity('quiz-completed', { page: detail.page, quizId: attempt.quizId, percent: attempt.percent }, completedAt);
    return persist();
  }

  async function recordActiveSession(detail) {
    await ready;
    if (!detail) return getSnapshot();
    if (detail.cleared) delete record.activeSessions['mock-exam'];
    else record.activeSessions['mock-exam'] = sanitizeActiveSession(detail);
    return persist();
  }

  async function recordMockExamAttempt(detail) {
    await ready;
    if (!detail || !Number.isFinite(Number(detail.percent))) return getSnapshot();
    const completedAt = detail.completedAt || nowIso();
    const attempt = {
      id: detail.attemptId || uid('mock'),
      examId: detail.examId || 'free-htl-mock-50',
      completedAt,
      mode: detail.mode || 'untimed',
      score: Number(detail.score || 0),
      total: Number(detail.total || 50),
      percent: Number(detail.percent),
      timeUsedMs: Number(detail.timeUsedMs || 0),
      timeExpired: Boolean(detail.timeExpired),
      domains: Array.isArray(detail.domains) ? detail.domains.map((item) => ({
        domain: item.domain,
        correct: Number(item.correct || 0),
        total: Number(item.total || 0),
        percent: Number(item.percent || 0)
      })) : [],
      questionResults: Array.isArray(detail.questionResults) ? detail.questionResults.map(sanitizeQuestionResult) : [],
      legacy: false
    };
    record.mockExamAttempts.unshift(attempt);
    record.mockExamAttempts = record.mockExamAttempts.slice(0, schema.mockAttemptLimit);
    delete record.activeSessions['mock-exam'];
    addActivity('mock-exam-completed', { examId: attempt.examId, percent: attempt.percent, mode: attempt.mode }, completedAt);
    return persist();
  }

  function bestQuizFor(page) {
    return record.quizAttempts
      .filter((attempt) => attempt.page === page)
      .reduce((best, attempt) => Math.max(best, Number(attempt.bestPercent ?? attempt.percent ?? 0)), 0);
  }

  function dashboardModel() {
    const moduleRows = access.modules
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((item) => {
        const progress = record.modules[item.id] || null;
        const tasks = Object.values(record.studyTasks).filter((task) => task.page === item.id && task.checked).length;
        const attempts = record.quizAttempts.filter((attempt) => attempt.page === item.id);
        const bestQuiz = bestQuizFor(item.id);
        const status = bestQuiz >= 80 ? 'Quiz target met' : (progress || attempts.length || tasks ? 'In progress' : 'Not started');
        return {
          ...item,
          status,
          bestQuiz,
          quizAttempts: attempts.length,
          tasksCompleted: tasks,
          lastSection: progress?.lastSection || null,
          lastActivityAt: progress?.lastActivityAt || null
        };
      });

    const domainValues = {};
    record.mockExamAttempts.forEach((attempt) => {
      attempt.domains.forEach((item) => {
        domainValues[item.domain] ||= [];
        domainValues[item.domain].push(Number(item.percent || 0));
      });
    });
    const domains = schema.domains.map((domain) => {
      const values = domainValues[domain] || [];
      return {
        domain,
        attempts: values.length,
        average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
        latest: values.length ? values[0] : null
      };
    });

    const latestMock = record.mockExamAttempts[0] || null;
    const bestMock = record.mockExamAttempts.reduce((best, attempt) => Math.max(best, Number(attempt.percent || 0)), 0);
    const completedTasks = Object.values(record.studyTasks).filter((task) => task.checked).length;
    const quizPercents = record.quizAttempts.map((attempt) => Number(attempt.percent || 0));
    const averageQuiz = quizPercents.length ? Math.round(quizPercents.reduce((sum, value) => sum + value, 0) / quizPercents.length) : null;
    const modulesStarted = moduleRows.filter((item) => item.status !== 'Not started').length;
    const modulesTargetMet = moduleRows.filter((item) => item.status === 'Quiz target met').length;

    let recommendation = {
      title: 'Begin with the public Fixation lesson',
      message: 'Complete the lesson and sample quiz to create your first progress record.',
      path: 'modules/fixation-guide-v3.html',
      accessTier: 'public'
    };
    if (record.activeSessions['mock-exam']) {
      recommendation = {
        title: 'Resume your unfinished mock exam',
        message: 'Your question position, selections, and flags are saved in this browser.',
        path: 'mock-exam.html#exam',
        accessTier: 'premium'
      };
    } else {
      const measured = domains.filter((item) => item.average !== null).sort((left, right) => left.average - right.average);
      if (measured.length) {
        const weakest = measured[0];
        const module = access.modules.find((item) => item.domain === weakest.domain);
        recommendation = {
          title: `Review ${weakest.domain}`,
          message: `Your average in this domain is ${weakest.average}%. Revisit the related lesson before another full exam.`,
          path: module?.path || 'study-plan.html',
          accessTier: module?.accessTier || 'premium'
        };
      } else {
        const nextModule = moduleRows.find((item) => item.status !== 'Quiz target met');
        if (nextModule) {
          recommendation = {
            title: nextModule.status === 'In progress' ? `Continue ${nextModule.title}` : `Start ${nextModule.title}`,
            message: nextModule.accessTier === 'public'
              ? 'Continue building your foundation and complete the module quiz.'
              : 'This lesson is marked for premium access in the final product.',
            path: nextModule.path,
            accessTier: nextModule.accessTier
          };
        }
      }
    }

    let coverage = 'Starting';
    if (modulesTargetMet >= 2 || latestMock) coverage = 'Building';
    if (modulesTargetMet >= 5 && bestMock >= 80) coverage = 'Broad coverage';

    return {
      account: {
        ownerKind: record.owner.kind,
        accountId: record.owner.accountId,
        entitlement: clone(record.entitlement),
        adapter: adapter.name,
        localOnly: adapter.name === 'local-browser'
      },
      summary: {
        modulesStarted,
        modulesTargetMet,
        totalModules: moduleRows.length,
        completedTasks,
        quizAttempts: record.quizAttempts.length,
        averageQuiz,
        mockAttempts: record.mockExamAttempts.length,
        latestMock,
        bestMock,
        coverage
      },
      modules: moduleRows,
      domains,
      recommendation,
      activeSessions: clone(record.activeSessions),
      recentActivity: record.activity.slice(0, 12),
      access: clone(access),
      updatedAt: record.updatedAt
    };
  }

  async function getDashboard() {
    await ready;
    return dashboardModel();
  }

  async function exportProgress() {
    await ready;
    return JSON.stringify({
      format: 'free-htl-progress-export',
      schemaVersion: schema.schemaVersion,
      exportedAt: nowIso(),
      progress: clone(record)
    }, null, 2);
  }

  async function resetProgress() {
    await ready;
    const prefixes = [
      schema.legacyKeys.lastSectionPrefix,
      schema.legacyKeys.studyTaskPrefix,
      schema.legacyKeys.quizScorePrefix,
      schema.legacyKeys.quizBestPrefix
    ];
    [...Array(localStorage.length).keys()]
      .map((index) => localStorage.key(index))
      .filter(Boolean)
      .forEach((key) => {
        if (prefixes.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
      });
    localStorage.removeItem(schema.legacyKeys.mockActive);
    localStorage.removeItem(schema.legacyKeys.mockHistory);
    await adapter.clear();
    record = defaultRecord();
    record.migration = { legacyVersion: 1, completedAt: nowIso(), importedRecords: 0 };
    addActivity('progress-reset');
    return persist();
  }

  async function useAdapter(nextAdapter) {
    await ready;
    const methods = ['load', 'save', 'clear'];
    if (!nextAdapter || methods.some((method) => typeof nextAdapter[method] !== 'function')) {
      throw new TypeError('Progress adapters must implement load, save, and clear.');
    }
    const current = clone(record);
    adapter = nextAdapter;
    const remote = await adapter.load();
    record = normalizeRecord(remote || current);
    return persist();
  }

  function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  window.addEventListener('htl:module-section', (event) => { void recordModuleSection(event.detail); });
  window.addEventListener('htl:study-task', (event) => { void recordStudyTask(event.detail); });
  window.addEventListener('htl:quiz-graded', (event) => { void recordQuizAttempt(event.detail); });
  window.addEventListener('htl:mock-state', (event) => { void recordActiveSession(event.detail); });
  window.addEventListener('htl:mock-completed', (event) => { void recordMockExamAttempt(event.detail); });

  window.FreeHTLProgress = {
    ready,
    getSnapshot,
    getDashboard,
    recordModuleSection,
    recordStudyTask,
    recordQuizAttempt,
    recordActiveSession,
    recordMockExamAttempt,
    exportProgress,
    resetProgress,
    useAdapter,
    subscribe,
    storageKey: () => schema?.storageKey || FALLBACK_STORAGE_KEY
  };
})();
