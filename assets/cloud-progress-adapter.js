(() => {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const asArray = (value) => Array.isArray(value) ? value : [];
  const asIso = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  };
  const newestIso = (...values) => values
    .flat()
    .filter(Boolean)
    .map((value) => asIso(value))
    .filter(Boolean)
    .sort()
    .at(-1) || nowIso();
  const oldestIso = (...values) => values
    .flat()
    .filter(Boolean)
    .map((value) => asIso(value))
    .filter(Boolean)
    .sort()
    .at(0) || null;
  const unique = (items) => [...new Set(asArray(items).filter(Boolean))];
  const boundedPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const nonNegativeInt = (value) => Math.max(0, Math.trunc(Number(value) || 0));

  function assertResult(result, context) {
    if (result?.error) {
      const error = new Error(`${context}: ${result.error.message || 'Supabase request failed.'}`);
      error.cause = result.error;
      throw error;
    }
    return result?.data ?? null;
  }

  function blankRecord(userId, schemaVersion = 1, profile = null) {
    const createdAt = profile?.created_at || nowIso();
    return {
      schemaVersion,
      recordId: `account-${userId}`,
      createdAt,
      updatedAt: profile?.updated_at || createdAt,
      owner: { kind: 'account', anonymousId: null, accountId: userId },
      entitlement: { tier: 'public', status: 'preview', source: 'server-development', updatedAt: createdAt },
      modules: {},
      studyTasks: {},
      quizAttempts: [],
      mockExamAttempts: [],
      targetedPracticeAttempts: [],
      activeSessions: {},
      activity: [],
      migration: { legacyVersion: 1, completedAt: null, importedRecords: 0 }
    };
  }

  function hasMeaningfulProgress(record) {
    if (!record || typeof record !== 'object') return false;
    return Boolean(
      Object.keys(record.modules || {}).length ||
      Object.keys(record.studyTasks || {}).length ||
      asArray(record.quizAttempts).length ||
      asArray(record.mockExamAttempts).length ||
      asArray(record.targetedPracticeAttempts).length ||
      Object.keys(record.activeSessions || {}).length ||
      asArray(record.activity).some((item) => item?.type && item.type !== 'progress-reset')
    );
  }

  function progressCounts(record) {
    return {
      modules: Object.keys(record?.modules || {}).length,
      studyTasks: Object.keys(record?.studyTasks || {}).length,
      quizAttempts: asArray(record?.quizAttempts).length,
      mockAttempts: asArray(record?.mockExamAttempts).length,
      targetedAttempts: asArray(record?.targetedPracticeAttempts).length,
      activeSessions: Object.keys(record?.activeSessions || {}).length
    };
  }

  function mergeModule(left = {}, right = {}) {
    const leftActivity = asIso(left.lastActivityAt);
    const rightActivity = asIso(right.lastActivityAt);
    const newest = !leftActivity ? right : !rightActivity ? left : (rightActivity > leftActivity ? right : left);
    return {
      moduleId: right.moduleId || left.moduleId,
      startedAt: oldestIso(left.startedAt, right.startedAt),
      lastActivityAt: newestIso(left.lastActivityAt, right.lastActivityAt),
      lastSection: newest.lastSection || left.lastSection || right.lastSection || null,
      sectionsViewed: unique([...(left.sectionsViewed || []), ...(right.sectionsViewed || [])]),
      completedAt: oldestIso(left.completedAt, right.completedAt)
    };
  }

  function mergeRecords(remote, local, userId) {
    const base = clone(remote || blankRecord(userId, local?.schemaVersion || 1));
    const incoming = clone(local || {});
    base.schemaVersion = Math.max(Number(base.schemaVersion) || 1, Number(incoming.schemaVersion) || 1);
    base.recordId = `account-${userId}`;
    base.owner = { kind: 'account', anonymousId: null, accountId: userId };
    base.createdAt = oldestIso(base.createdAt, incoming.createdAt) || nowIso();
    base.updatedAt = newestIso(base.updatedAt, incoming.updatedAt);

    Object.entries(incoming.modules || {}).forEach(([key, value]) => {
      base.modules[key] = mergeModule(base.modules[key], value);
    });

    Object.entries(incoming.studyTasks || {}).forEach(([key, value]) => {
      const existing = base.studyTasks[key];
      const existingAt = asIso(existing?.updatedAt);
      const incomingAt = asIso(value?.updatedAt);
      if (!existing || !existingAt || (incomingAt && incomingAt >= existingAt)) base.studyTasks[key] = value;
    });

    ['quizAttempts', 'mockExamAttempts', 'targetedPracticeAttempts'].forEach((key) => {
      const byId = new Map(asArray(base[key]).filter((item) => item?.id).map((item) => [item.id, item]));
      asArray(incoming[key]).filter((item) => item?.id).forEach((item) => {
        if (!byId.has(item.id)) byId.set(item.id, item);
      });
      base[key] = [...byId.values()].sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
    });

    Object.entries(incoming.activeSessions || {}).forEach(([key, value]) => {
      const existing = base.activeSessions[key];
      const existingAt = asIso(existing?.updatedAt || existing?.startedAt);
      const incomingAt = asIso(value?.updatedAt || value?.startedAt);
      if (!existing || !existingAt || (incomingAt && incomingAt >= existingAt)) base.activeSessions[key] = value;
    });

    const activityById = new Map(asArray(base.activity).filter((item) => item?.id).map((item) => [item.id, item]));
    asArray(incoming.activity).filter((item) => item?.id).forEach((item) => {
      if (!activityById.has(item.id)) activityById.set(item.id, item);
    });
    base.activity = [...activityById.values()]
      .sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')))
      .slice(0, 100);
    return base;
  }

  class CloudProgressAdapter {
    constructor(client, userId, options = {}) {
      if (!client?.from) throw new TypeError('A Supabase client is required.');
      if (!userId) throw new TypeError('An authenticated user ID is required.');
      this.client = client;
      this.userId = userId;
      this.schemaVersion = Number(options.schemaVersion || 1);
      this.name = 'supabase-cloud';
      this.lastLoadedRecord = null;
    }

    async selectTable(table, columns = '*') {
      const result = await this.client.from(table).select(columns).eq('user_id', this.userId);
      return assertResult(result, `Load ${table}`) || [];
    }

    async load() {
      const [profiles, modules, tasks, attempts, domains, questions, sessions, responses, activity, migrations] = await Promise.all([
        this.selectTable('profiles'),
        this.selectTable('module_progress'),
        this.selectTable('study_task_progress'),
        this.selectTable('learning_attempts'),
        this.selectTable('attempt_domain_results'),
        this.selectTable('attempt_question_results'),
        this.selectTable('active_sessions'),
        this.selectTable('active_session_responses'),
        this.selectTable('learning_activity'),
        this.selectTable('progress_migrations')
      ]);

      const record = blankRecord(this.userId, this.schemaVersion, profiles[0] || null);
      const domainsByAttempt = new Map();
      domains.forEach((row) => {
        if (!domainsByAttempt.has(row.attempt_id)) domainsByAttempt.set(row.attempt_id, []);
        domainsByAttempt.get(row.attempt_id).push({
          domain: row.domain_id,
          correct: Number(row.correct_count || 0),
          total: Number(row.question_count || 0),
          percent: Number(row.percent || 0)
        });
      });
      const questionsByAttempt = new Map();
      questions.forEach((row) => {
        if (!questionsByAttempt.has(row.attempt_id)) questionsByAttempt.set(row.attempt_id, []);
        questionsByAttempt.get(row.attempt_id).push({
          questionId: row.question_id,
          sourceQuestionId: row.source_question_id,
          moduleId: row.module_id,
          domain: row.domain_id,
          difficulty: row.difficulty,
          selectedOptionId: row.selected_option_id,
          correct: Boolean(row.is_correct),
          flagged: Boolean(row.was_flagged)
        });
      });

      modules.forEach((row) => {
        record.modules[row.module_id] = {
          moduleId: row.module_id,
          startedAt: row.started_at,
          lastActivityAt: row.last_activity_at,
          lastSection: row.last_section_id,
          sectionsViewed: asArray(row.sections_viewed),
          completedAt: row.completed_at,
          revision: Number(row.revision || 1)
        };
      });
      tasks.forEach((row) => {
        record.studyTasks[`${row.page_id}:${row.task_id}`] = {
          page: row.page_id,
          taskId: row.task_id,
          checked: Boolean(row.completed),
          updatedAt: row.updated_at,
          revision: Number(row.revision || 1)
        };
      });

      attempts
        .slice()
        .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
        .forEach((row) => {
          const common = {
            id: row.attempt_id,
            completedAt: row.completed_at,
            score: Number(row.correct_count || 0),
            total: Number(row.question_count || 0),
            percent: Number(row.percent || 0),
            legacy: Boolean(row.legacy)
          };
          if (row.attempt_type === 'module_quiz') {
            record.quizAttempts.push({
              ...common,
              page: row.module_id,
              quizId: row.activity_id,
              targetMet: Number(row.percent || 0) >= 80,
              bestPercent: Number(row.percent || 0)
            });
          } else if (row.attempt_type === 'mock_exam') {
            record.mockExamAttempts.push({
              ...common,
              examId: row.activity_id,
              mode: row.mode || 'untimed',
              timeUsedMs: Number(row.duration_ms || 0),
              timeExpired: Boolean(row.time_expired),
              domains: domainsByAttempt.get(row.attempt_id) || [],
              questionResults: questionsByAttempt.get(row.attempt_id) || []
            });
          } else if (row.attempt_type === 'targeted_practice') {
            record.targetedPracticeAttempts.push({
              ...common,
              practiceId: row.activity_id,
              startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
              mode: row.mode === 'exam' ? 'exam' : 'study',
              sourceMode: row.source_mode || 'custom',
              selectedDomains: asArray(row.selected_domains),
              selectedDifficulties: asArray(row.selected_difficulties),
              requestedCount: row.requested_count,
              timeUsedMs: Number(row.duration_ms || 0),
              domains: domainsByAttempt.get(row.attempt_id) || [],
              questionResults: questionsByAttempt.get(row.attempt_id) || []
            });
          }
        });

      const responsesByType = new Map();
      responses.forEach((row) => {
        if (!responsesByType.has(row.session_type)) responsesByType.set(row.session_type, []);
        responsesByType.get(row.session_type).push(row);
      });
      sessions.forEach((row) => {
        const rows = responsesByType.get(row.session_type) || [];
        const responseMap = Object.fromEntries(rows.filter((item) => item.selected_option_id).map((item) => [item.question_id, item.selected_option_id]));
        const flags = rows.filter((item) => item.is_flagged).map((item) => item.question_id);
        const checked = rows.filter((item) => item.feedback_checked).map((item) => item.question_id);
        if (row.session_type === 'mock-exam') {
          record.activeSessions['mock-exam'] = {
            attemptId: row.session_id,
            examId: row.activity_id,
            mode: row.mode,
            startedAt: row.started_at,
            expiresAt: row.expires_at,
            currentIndex: Number(row.current_index || 0),
            questionIds: asArray(row.question_ids),
            responses: responseMap,
            flags,
            updatedAt: row.server_updated_at,
            revision: Number(row.revision || 1)
          };
        } else {
          record.activeSessions['targeted-practice'] = {
            attemptId: row.session_id,
            practiceId: row.activity_id,
            mode: row.mode === 'exam' ? 'exam' : 'study',
            sourceMode: row.source_mode || 'custom',
            selectedDomains: asArray(row.selected_domains),
            selectedDifficulties: asArray(row.selected_difficulties),
            requestedCount: Number(row.requested_count || row.question_ids?.length || 10),
            startedAt: row.started_at ? new Date(row.started_at).getTime() : Date.now(),
            currentIndex: Number(row.current_index || 0),
            questionIds: asArray(row.question_ids),
            responses: responseMap,
            flags,
            checked,
            updatedAt: row.server_updated_at,
            revision: Number(row.revision || 1)
          };
        }
      });

      record.activity = activity
        .slice()
        .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
        .map((row) => ({
          id: row.activity_id,
          type: row.activity_type,
          occurredAt: row.occurred_at,
          page: row.module_id,
          taskId: row.task_id,
          attemptId: row.related_attempt_id,
          mode: row.mode,
          percent: row.percent === null ? null : Number(row.percent),
          importedRecords: row.imported_record_count
        }));

      const completedMigrations = migrations.filter((row) => row.status === 'completed');
      if (completedMigrations.length) {
        const latest = completedMigrations.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
        record.migration = {
          legacyVersion: 1,
          completedAt: latest.completed_at,
          importedRecords: Number(latest.module_count || 0) + Number(latest.study_task_count || 0) +
            Number(latest.quiz_attempt_count || 0) + Number(latest.mock_attempt_count || 0) +
            Number(latest.targeted_attempt_count || 0) + Number(latest.active_session_count || 0)
        };
      }

      record.updatedAt = newestIso(
        record.createdAt,
        modules.map((row) => row.updated_at),
        tasks.map((row) => row.updated_at),
        attempts.map((row) => row.completed_at),
        sessions.map((row) => row.server_updated_at),
        activity.map((row) => row.occurred_at),
        migrations.map((row) => row.updated_at)
      );
      this.lastLoadedRecord = clone(record);
      return record;
    }

    async save(record) {
      const userId = this.userId;
      const moduleRows = Object.values(record.modules || {}).filter((item) => item?.moduleId).map((item) => ({
        user_id: userId,
        module_id: item.moduleId,
        started_at: asIso(item.startedAt),
        last_activity_at: asIso(item.lastActivityAt),
        last_section_id: item.lastSection || null,
        sections_viewed: unique(item.sectionsViewed),
        completed_at: asIso(item.completedAt)
      }));
      if (moduleRows.length) assertResult(await this.client.from('module_progress').upsert(moduleRows, { onConflict: 'user_id,module_id' }), 'Save module progress');

      const taskRows = Object.values(record.studyTasks || {}).filter((item) => item?.page && item?.taskId).map((item) => ({
        user_id: userId,
        page_id: item.page,
        task_id: item.taskId,
        completed: Boolean(item.checked),
        completed_at: item.checked ? asIso(item.updatedAt, nowIso()) : null
      }));
      if (taskRows.length) assertResult(await this.client.from('study_task_progress').upsert(taskRows, { onConflict: 'user_id,page_id,task_id' }), 'Save study tasks');

      const attempts = [];
      const domainRows = [];
      const questionRows = [];
      const appendAttempt = (attempt, type) => {
        if (!attempt?.id) return;
        const total = nonNegativeInt(attempt.total);
        const correct = Math.min(total, nonNegativeInt(attempt.score));
        attempts.push({
          user_id: userId,
          attempt_id: attempt.id,
          attempt_type: type,
          activity_id: type === 'module_quiz' ? attempt.quizId : type === 'mock_exam' ? attempt.examId : attempt.practiceId,
          module_id: type === 'module_quiz' ? attempt.page : null,
          mode: type === 'module_quiz' ? null : attempt.mode || null,
          source_mode: type === 'targeted_practice' ? attempt.sourceMode || 'custom' : null,
          selected_domains: type === 'targeted_practice' ? unique(attempt.selectedDomains) : [],
          selected_difficulties: type === 'targeted_practice' ? unique(attempt.selectedDifficulties) : [],
          requested_count: type === 'targeted_practice' ? (nonNegativeInt(attempt.requestedCount) || null) : null,
          started_at: type === 'targeted_practice' ? asIso(attempt.startedAt) : null,
          completed_at: asIso(attempt.completedAt, nowIso()),
          correct_count: correct,
          question_count: total,
          percent: boundedPercent(attempt.percent),
          duration_ms: type === 'module_quiz' ? null : nonNegativeInt(attempt.timeUsedMs),
          time_expired: type === 'mock_exam' ? Boolean(attempt.timeExpired) : false,
          legacy: Boolean(attempt.legacy)
        });
        asArray(attempt.domains).filter((item) => item?.domain).forEach((item) => {
          const domainTotal = nonNegativeInt(item.total);
          domainRows.push({
            user_id: userId,
            attempt_id: attempt.id,
            domain_id: item.domain,
            correct_count: Math.min(domainTotal, nonNegativeInt(item.correct)),
            question_count: domainTotal,
            percent: boundedPercent(item.percent)
          });
        });
        asArray(attempt.questionResults).filter((item) => item?.questionId).forEach((item) => {
          questionRows.push({
            user_id: userId,
            attempt_id: attempt.id,
            question_id: item.questionId,
            source_question_id: item.sourceQuestionId || item.questionId,
            module_id: item.moduleId || null,
            domain_id: item.domain || null,
            difficulty: item.difficulty || null,
            selected_option_id: item.selectedOptionId || null,
            is_correct: Boolean(item.correct),
            was_flagged: Boolean(item.flagged)
          });
        });
      };
      asArray(record.quizAttempts).forEach((item) => appendAttempt(item, 'module_quiz'));
      asArray(record.mockExamAttempts).forEach((item) => appendAttempt(item, 'mock_exam'));
      asArray(record.targetedPracticeAttempts).forEach((item) => appendAttempt(item, 'targeted_practice'));
      if (attempts.length) assertResult(await this.client.from('learning_attempts').upsert(attempts, { onConflict: 'user_id,attempt_id', ignoreDuplicates: true }), 'Save learning attempts');
      if (domainRows.length) assertResult(await this.client.from('attempt_domain_results').upsert(domainRows, { onConflict: 'user_id,attempt_id,domain_id', ignoreDuplicates: true }), 'Save attempt domains');
      if (questionRows.length) assertResult(await this.client.from('attempt_question_results').upsert(questionRows, { onConflict: 'user_id,attempt_id,question_id', ignoreDuplicates: true }), 'Save question outcomes');

      for (const sessionType of ['mock-exam', 'targeted-practice']) {
        const session = record.activeSessions?.[sessionType];
        if (!session) {
          assertResult(await this.client.from('active_sessions').delete().eq('user_id', userId).eq('session_type', sessionType), `Clear ${sessionType} session`);
          continue;
        }
        const activityId = sessionType === 'mock-exam' ? session.examId : session.practiceId;
        const sessionId = session.attemptId || `${sessionType}-${activityId || 'session'}`;
        const sessionRow = {
          user_id: userId,
          session_type: sessionType,
          session_id: sessionId,
          activity_id: activityId || (sessionType === 'mock-exam' ? 'free-htl-mock-50' : 'free-htl-targeted-practice'),
          mode: session.mode || (sessionType === 'mock-exam' ? 'untimed' : 'study'),
          source_mode: sessionType === 'targeted-practice' ? session.sourceMode || 'custom' : null,
          selected_domains: sessionType === 'targeted-practice' ? unique(session.selectedDomains) : [],
          selected_difficulties: sessionType === 'targeted-practice' ? unique(session.selectedDifficulties) : [],
          requested_count: sessionType === 'targeted-practice' ? (nonNegativeInt(session.requestedCount) || null) : null,
          current_index: nonNegativeInt(session.currentIndex),
          question_ids: unique(session.questionIds),
          started_at: asIso(session.startedAt, nowIso()),
          expires_at: asIso(session.expiresAt),
          client_updated_at: asIso(session.updatedAt, nowIso())
        };
        assertResult(await this.client.from('active_sessions').upsert(sessionRow, { onConflict: 'user_id,session_type' }), `Save ${sessionType} session`);
        assertResult(await this.client.from('active_session_responses').delete().eq('user_id', userId).eq('session_type', sessionType), `Refresh ${sessionType} responses`);
        const responseIds = unique([
          ...Object.keys(isObject(session.responses) ? session.responses : {}),
          ...asArray(session.flags),
          ...asArray(session.checked)
        ]);
        const responseRows = responseIds.map((questionId) => ({
          user_id: userId,
          session_type: sessionType,
          question_id: questionId,
          selected_option_id: session.responses?.[questionId] || null,
          is_flagged: asArray(session.flags).includes(questionId),
          feedback_checked: asArray(session.checked).includes(questionId)
        }));
        if (responseRows.length) assertResult(await this.client.from('active_session_responses').insert(responseRows), `Save ${sessionType} responses`);
      }

      const activityRows = asArray(record.activity).filter((item) => item?.id && item?.type).map((item) => ({
        user_id: userId,
        activity_id: item.id,
        activity_type: item.type,
        occurred_at: asIso(item.occurredAt, nowIso()),
        module_id: item.page || null,
        task_id: item.taskId || null,
        related_attempt_id: item.attemptId || null,
        mode: item.mode || null,
        percent: item.percent === null || item.percent === undefined ? null : boundedPercent(item.percent),
        imported_record_count: item.importedRecords === null || item.importedRecords === undefined ? null : nonNegativeInt(item.importedRecords)
      }));
      if (activityRows.length) assertResult(await this.client.from('learning_activity').upsert(activityRows, { onConflict: 'user_id,activity_id', ignoreDuplicates: true }), 'Save learning activity');

      this.lastLoadedRecord = clone(record);
      return clone(record);
    }

    async hasCompletedMigration(anonymousRecordId) {
      if (!anonymousRecordId) return false;
      const result = await this.client.from('progress_migrations')
        .select('status')
        .eq('user_id', this.userId)
        .eq('anonymous_record_id', anonymousRecordId)
        .eq('status', 'completed')
        .limit(1);
      return Boolean(assertResult(result, 'Check progress migration')?.length);
    }

    async importRecord(localRecord) {
      if (!localRecord?.recordId) throw new TypeError('The browser progress record is missing its stable record ID.');
      if (await this.hasCompletedMigration(localRecord.recordId)) return this.load();
      const counts = progressCounts(localRecord);
      const migrationRow = {
        user_id: this.userId,
        anonymous_record_id: localRecord.recordId,
        source_schema_version: Number(localRecord.schemaVersion || this.schemaVersion || 1),
        status: 'started',
        completed_at: null,
        module_count: counts.modules,
        study_task_count: counts.studyTasks,
        quiz_attempt_count: counts.quizAttempts,
        mock_attempt_count: counts.mockAttempts,
        targeted_attempt_count: counts.targetedAttempts,
        active_session_count: counts.activeSessions
      };
      assertResult(await this.client.from('progress_migrations').upsert(migrationRow, { onConflict: 'user_id,anonymous_record_id' }), 'Start progress migration');
      try {
        const remote = await this.load();
        const merged = mergeRecords(remote, localRecord, this.userId);
        await this.save(merged);
        assertResult(await this.client.from('progress_migrations')
          .update({ status: 'completed', completed_at: nowIso() })
          .eq('user_id', this.userId)
          .eq('anonymous_record_id', localRecord.recordId), 'Complete progress migration');
        return this.load();
      } catch (error) {
        await this.client.from('progress_migrations')
          .update({ status: 'failed', completed_at: null })
          .eq('user_id', this.userId)
          .eq('anonymous_record_id', localRecord.recordId);
        throw error;
      }
    }

    async clear() {
      for (const table of ['progress_migrations', 'learning_activity', 'active_sessions', 'learning_attempts', 'study_task_progress', 'module_progress']) {
        assertResult(await this.client.from(table).delete().eq('user_id', this.userId), `Clear ${table}`);
      }
      this.lastLoadedRecord = blankRecord(this.userId, this.schemaVersion);
    }
  }

  window.FreeHTLCloudProgressAdapter = Object.freeze({
    CloudProgressAdapter,
    blankRecord,
    hasMeaningfulProgress,
    progressCounts,
    mergeRecords
  });
})();