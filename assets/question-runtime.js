((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FreeHTLQuestionRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const OPTION_IDS = ['A', 'B', 'C', 'D'];
  const SESSION_TYPES = new Set([
    'module_quiz', 'mixed_practice', 'mock_exam', 'targeted_practice',
    'missed_review', 'flagged_review'
  ]);

  function hashSeed(value) {
    let hash = 2166136261;
    const text = String(value ?? '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(items, seed) {
    const result = [...items];
    const random = seededRandom(seed);
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function normalizeRequest(request = {}) {
    const sessionType = request.sessionType || 'mixed_practice';
    if (!SESSION_TYPES.has(sessionType)) throw new Error(`Unsupported session type: ${sessionType}`);
    const count = Number(request.count ?? 10);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      throw new Error('Question count must be an integer from 1 to 200.');
    }
    const accessScope = request.accessScope;
    if (!['sample', 'premium'].includes(accessScope)) {
      throw new Error('Trusted accessScope must be sample or premium.');
    }
    return {
      sessionType,
      count,
      accessScope,
      certificationScope: request.certificationScope || 'HT_HTL',
      domains: new Set(request.domains || []),
      topics: new Set(request.topics || []),
      difficulties: new Set(request.difficulties || []),
      cognitiveLevels: new Set(request.cognitiveLevels || []),
      includeIds: new Set(request.includeIds || []),
      excludeIds: new Set([...(request.excludeIds || []), ...(request.recentIds || [])]),
      seed: String(request.seed || 'free-htl-guide'),
      shuffleOptions: request.shuffleOptions !== false,
      blueprint: request.blueprint || null,
    };
  }

  function scopeAllows(question, accessScope) {
    return question.access === 'sample' || accessScope === 'premium';
  }

  function scopeMatches(questionScope, requestedScope) {
    return questionScope === 'HT_HTL' || requestedScope === 'HT_HTL' || questionScope === requestedScope;
  }

  function eligible(question, request) {
    if (!question || question.status !== 'approved') return false;
    if (!scopeAllows(question, request.accessScope)) return false;
    if (!scopeMatches(question.certification_scope, request.certificationScope)) return false;
    if (request.includeIds.size && !request.includeIds.has(question.id)) return false;
    if (request.excludeIds.has(question.id)) return false;
    if (request.domains.size && !request.domains.has(question.domain)) return false;
    if (request.topics.size && !request.topics.has(question.topic)) return false;
    if (request.difficulties.size && !request.difficulties.has(question.difficulty)) return false;
    if (request.cognitiveLevels.size && !request.cognitiveLevels.has(question.cognitive_level)) return false;
    return true;
  }

  function selectBlueprint(pool, request) {
    const targets = request.blueprint?.domainTargets;
    if (!targets) return null;
    const selected = [];
    const used = new Set();
    for (const [domain, targetRaw] of Object.entries(targets)) {
      const target = Number(targetRaw);
      if (!Number.isInteger(target) || target < 0) throw new Error(`Invalid blueprint target for ${domain}.`);
      const candidates = shuffled(
        pool.filter((question) => question.domain === domain && !used.has(question.id)),
        `${request.seed}:domain:${domain}`
      );
      if (candidates.length < target) {
        throw new Error(`Eligible pool cannot satisfy blueprint target for ${domain}: ${target} requested, ${candidates.length} available.`);
      }
      candidates.slice(0, target).forEach((question) => {
        selected.push(question);
        used.add(question.id);
      });
    }
    if (selected.length > request.count) throw new Error('Blueprint targets exceed requested question count.');
    const remaining = request.count - selected.length;
    if (remaining) {
      const fill = shuffled(pool.filter((question) => !used.has(question.id)), `${request.seed}:fill`);
      if (fill.length < remaining) throw new Error('Eligible pool cannot fill the requested session after blueprint allocation.');
      selected.push(...fill.slice(0, remaining));
    }
    return shuffled(selected, `${request.seed}:session-order`);
  }

  function selectQuestions(bank, rawRequest) {
    const request = normalizeRequest(rawRequest);
    const pool = bank.filter((question) => eligible(question, request));
    if (pool.length < request.count) {
      throw new Error(`Eligible pool contains ${pool.length} question(s); ${request.count} requested.`);
    }
    const selected = selectBlueprint(pool, request) || shuffled(pool, `${request.seed}:questions`).slice(0, request.count);
    return { request, selected };
  }

  function answerPayload(question, position, request) {
    const options = request.shuffleOptions
      ? shuffled(question.options, `${request.seed}:${question.id}:options`)
      : question.options.map((option) => ({ ...option }));
    return {
      id: question.id,
      version: question.version,
      position,
      stem: question.stem,
      options: options.map(({ id, text }) => ({ id, text })),
      domain: question.domain,
      topic: question.topic,
      difficulty: question.difficulty,
      cognitive_level: question.cognitive_level,
    };
  }

  function createSession(bank, rawRequest) {
    const { request, selected } = selectQuestions(bank, rawRequest);
    return {
      sessionType: request.sessionType,
      seed: request.seed,
      count: selected.length,
      questions: selected.map((question, index) => answerPayload(question, index + 1, request)),
    };
  }

  function gradeResponse(question, selectedOptionId) {
    if (!OPTION_IDS.includes(selectedOptionId)) throw new Error('Selected option must be A, B, C, or D.');
    const correct = selectedOptionId === question.correct_option_id;
    return {
      questionId: question.id,
      questionVersion: question.version,
      selectedOptionId,
      correctOptionId: question.correct_option_id,
      correct,
      rationale: question.rationale,
      selectedDistractorRationale: correct ? null : question.distractor_rationales[selectedOptionId] || null,
      lessonRefs: [...question.lesson_refs],
      domain: question.domain,
      topic: question.topic,
    };
  }

  function findQuestion(bank, questionId, version) {
    const question = bank.find((item) => item.id === questionId && item.version === version);
    if (!question) throw new Error(`Question ${questionId} version ${version} was not found.`);
    return question;
  }

  function gradeSubmission(bank, submission) {
    const question = findQuestion(bank, submission.questionId, submission.questionVersion);
    return gradeResponse(question, submission.selectedOptionId);
  }

  return Object.freeze({
    createSession,
    eligible,
    gradeResponse,
    gradeSubmission,
    hashSeed,
    normalizeRequest,
    seededRandom,
    shuffled,
  });
});
