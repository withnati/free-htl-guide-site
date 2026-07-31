(() => {
  'use strict';
  const ui = window.FreeHTLMockExamUI;

  function summarize(attempt, blueprint) {
    const fields = ui.$$('fieldset[data-exam-question-id]', ui.refs.form);
    const score = fields.filter((field) => field.classList.contains('correct')).length;
    const total = fields.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const domains = blueprint.blueprint.map((domain) => {
      const domainFields = fields.filter((field) => field.dataset.examDomain === domain.domain);
      const correct = domainFields.filter((field) => field.classList.contains('correct')).length;
      return { domain: domain.domain, correct, total: domainFields.length, percent: domainFields.length ? Math.round((correct / domainFields.length) * 100) : 0 };
    });
    return { score, total, percent, domains, fields };
  }

  function interpretation(percent) {
    if (percent >= 80) return ['Study target met', 'Use the domain breakdown to protect weaker areas and repeat the exam with a new question order.'];
    if (percent >= 65) return ['Developing exam readiness', 'Review the lowest domains, then repeat focused module quizzes before another full attempt.'];
    return ['Focused review recommended', 'Return to the core modules and work through explanations before repeating a full mock exam.'];
  }

  function addTargetedPracticeAction(summary) {
    const actions = ui.$('.result-actions');
    if (!actions || actions.querySelector('[data-targeted-practice-link]')) return;
    const weakest = [...summary.domains].sort((left, right) => left.percent - right.percent)[0];
    const link = document.createElement('a');
    link.className = 'btn';
    link.dataset.targetedPracticeLink = 'true';
    link.href = `targeted-practice.html?source=weak${weakest ? `&domain=${encodeURIComponent(weakest.domain)}` : ''}`;
    link.textContent = weakest ? `Practice ${weakest.domain}` : 'Targeted practice';
    actions.appendChild(link);
  }

  function render(summary, attempt, completedAt) {
    const [heading, message] = interpretation(summary.percent);
    ui.refs.resultDate.textContent = new Date(completedAt).toLocaleString();
    ui.refs.resultPercent.textContent = `${summary.percent}%`;
    ui.refs.resultScore.textContent = `${summary.score}/${summary.total}`;
    ui.refs.resultInterpretation.textContent = heading;
    ui.refs.resultSummary.textContent = message;
    ui.refs.domainResults.innerHTML = summary.domains.map((item) => `
      <article class="domain-result"><strong>${item.domain}</strong><span>${item.correct}/${item.total}</span>
      <div class="domain-bar"><i style="width:${item.percent}%"></i></div><small>${item.percent}%</small></article>`).join('');

    ui.refs.review.innerHTML = '';
    summary.fields.forEach((field) => {
      const questionId = field.dataset.examQuestionId;
      if (field.classList.contains('correct') && !attempt.flags.includes(questionId)) return;
      const question = attempt.questions.find((item) => item.id === questionId);
      const article = document.createElement('article');
      article.className = 'review-item';
      const clone = field.cloneNode(true);
      clone.hidden = false;
      clone.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      article.innerHTML = `<p class="small muted">${question.domain} · ${question.difficulty}</p>`;
      article.appendChild(clone);
      const link = document.createElement('a');
      link.className = 'btn btn-small';
      link.href = question.sourcePath;
      link.textContent = `Review ${question.moduleTitle}`;
      article.appendChild(link);
      ui.refs.review.appendChild(article);
    });
    if (!ui.refs.review.children.length) ui.refs.review.innerHTML = '<div class="callout safe">No missed or flagged questions in this attempt.</div>';
    addTargetedPracticeAction(summary);
    ui.refs.exam.hidden = true;
    ui.refs.results.hidden = false;
    ui.refs.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    ui.$('#resultsHeading')?.focus();
  }

  window.FreeHTLMockExamResults = { summarize, render };
})();
