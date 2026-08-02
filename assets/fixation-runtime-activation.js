(() => {
  'use strict';

  const script = document.currentScript;
  const assetBase = new URL('./', script?.src || window.location.href);
  const dataUrl = new URL('../data/fixation-runtime-bank.json', assetBase);
  const runtimeUrl = new URL('question-runtime.js', assetBase);
  const adapterUrl = new URL('fixation-canonical-adapter.js', assetBase);
  const page = document.body?.dataset.page;

  if (page !== 'fixation-v3') return;

  function loadScript(url, marker) {
    if (window[marker]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      element.src = url.href;
      element.async = false;
      element.addEventListener('load', resolve, { once: true });
      element.addEventListener('error', () => reject(new Error(`Could not load ${url.pathname}`)), { once: true });
      document.head.appendChild(element);
    });
  }

  function resultElement(form) {
    const result = form.parentElement?.querySelector('.quiz-result') || document.getElementById('quizResult');
    if (result && !result.id) result.id = 'quizResult';
    return result;
  }

  function setBest(percent) {
    const bestKey = `best:${page}`;
    const previousBest = Number(localStorage.getItem(bestKey) || 0);
    const best = Math.max(previousBest, percent);
    if (percent > previousBest) localStorage.setItem(bestKey, String(percent));
    const display = document.querySelector('[data-best]');
    if (display) display.textContent = `Best: ${best}%`;
  }

  function renderFeedback(form, bank, results) {
    const byId = new Map(bank.map((question) => [`${question.id}:${question.version}`, question]));
    const fields = [...form.querySelectorAll('fieldset[data-question-id]')];
    results.forEach((result, index) => {
      const fieldset = fields[index];
      const question = byId.get(`${result.questionId}:${result.questionVersion}`);
      if (!fieldset || !question) return;
      fieldset.classList.remove('correct', 'incorrect');
      fieldset.classList.add(result.correct ? 'correct' : 'incorrect');
      const explanation = fieldset.querySelector('.explanation');
      if (!explanation) return;
      if (result.correct) {
        explanation.textContent = `Correct. ${question.rationale}`;
      } else if (result.omitted) {
        explanation.textContent = `Review: No answer was selected. Correct answer: ${question.correct_option_id}. ${question.rationale}`;
      } else {
        const distractor = result.selectedDistractorRationale ? `${result.selectedDistractorRationale} ` : '';
        explanation.textContent = `Review: ${distractor}Correct answer: ${question.correct_option_id}. ${question.rationale}`;
      }
      explanation.hidden = false;
    });
  }

  function reset(form) {
    form.reset();
    delete form.dataset.runtimeSubmitted;
    form.querySelectorAll('fieldset').forEach((fieldset) => fieldset.classList.remove('correct', 'incorrect'));
    form.querySelectorAll('.explanation').forEach((explanation) => {
      explanation.hidden = true;
      explanation.textContent = '';
    });
    const result = resultElement(form);
    if (result) result.hidden = true;
    window.dispatchEvent(new CustomEvent('htl:quiz-reset', { detail: { page, quizId: form.id } }));
    form.querySelector('input[type="radio"]')?.focus();
  }

  async function activate() {
    const form = document.getElementById('fixQuiz');
    if (!form) return;

    const legacyMarkup = form.innerHTML;
    try {
      await loadScript(runtimeUrl, 'FreeHTLQuestionRuntime');
      await loadScript(adapterUrl, 'FreeHTLFixationCanonicalAdapter');
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Fixation bank request failed with ${response.status}.`);
      const bank = await response.json();
      const runtime = window.FreeHTLQuestionRuntime;
      const adapter = window.FreeHTLFixationCanonicalAdapter;
      if (!runtime || !adapter || !Array.isArray(bank) || bank.length !== 10) {
        throw new Error('Canonical Fixation runtime dependencies are incomplete.');
      }

      const session = adapter.createPilotSession(bank, 'fixation-v3-public-v1');
      if (session.count !== 10) throw new Error('Canonical Fixation session did not contain ten approved questions.');
      adapter.renderIntoForm(form, session);
      form.dataset.runtimeSource = 'canonical';
      document.body.dataset.fixationRuntime = 'active';
      resultElement(form);

      document.addEventListener('click', (event) => {
        const gradeButton = event.target.closest('[data-grade="fixQuiz"]');
        const retryButton = event.target.closest('[data-retry="fixQuiz"]');
        if (!gradeButton && !retryButton) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        if (retryButton) {
          reset(form);
          return;
        }

        const results = adapter.gradeForm(bank, form);
        renderFeedback(form, bank, results);
        const attempt = adapter.toProgressAttempt(results, {
          attemptId: globalThis.crypto?.randomUUID?.() || `fixation-${Date.now()}`,
          completedAt: new Date().toISOString(),
        });
        const result = resultElement(form);
        if (result) {
          result.hidden = false;
          result.setAttribute('role', 'status');
          result.setAttribute('aria-live', 'polite');
          result.tabIndex = -1;
          result.textContent = `Score: ${attempt.score}/${attempt.total} (${attempt.percent}%). ${attempt.targetMet
            ? 'Study target met. Review the explanations, then continue to the next topic.'
            : 'Review each explanation and try again after revisiting the weak points.'}`;
          result.focus({ preventScroll: true });
        }
        localStorage.setItem(`quiz:${page}`, String(attempt.percent));
        setBest(attempt.percent);

        if (!form.dataset.runtimeSubmitted) {
          form.dataset.runtimeSubmitted = 'true';
          window.dispatchEvent(new CustomEvent('htl:quiz-graded', { detail: attempt }));
        }
      }, true);
    } catch (error) {
      form.innerHTML = legacyMarkup;
      document.body.dataset.fixationRuntime = 'fallback';
      console.error('Canonical Fixation runtime activation failed; legacy quiz retained.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate, { once: true });
  } else {
    activate();
  }
})();
