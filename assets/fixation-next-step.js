(() => {
  'use strict';

  if (document.body?.dataset.page !== 'fixation-v3') return;

  const PANEL_ID = 'fixation-next-step';

  function url(path) {
    return new URL(path, window.location.href).href;
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    const quiz = document.getElementById('quiz');
    const result = quiz?.querySelector('.quiz-result');
    if (!quiz || !result) return null;

    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'callout safe';
    panel.dataset.fixationNextStep = 'true';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', `${PANEL_ID}-heading`);
    panel.innerHTML = `
      <p class="eyebrow">Next study step</p>
      <h3 id="${PANEL_ID}-heading" data-fixation-next-heading>Keep building from Fixation</h3>
      <p data-fixation-next-copy></p>
      <p>
        <a class="btn btn-primary" data-fixation-next-processing href="${url('processing-guide-v3.html')}">Continue to Processing</a>
        <a class="btn" data-fixation-next-progress href="${url('../my-progress.html')}">Open My Progress</a>
      </p>
      <p class="small muted">Processing and Decalcification is a Premium lesson. The next page shows what is available now and the access attached to your account.</p>
    `;
    result.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function render(attempt = {}) {
    const panel = ensurePanel();
    if (!panel) return;

    const heading = panel.querySelector('[data-fixation-next-heading]');
    const copy = panel.querySelector('[data-fixation-next-copy]');
    const targetMet = attempt.targetMet === true;

    if (heading) {
      heading.textContent = targetMet
        ? 'Fixation target met — choose your next step'
        : 'Review Fixation, then keep moving';
    }
    if (copy) {
      copy.textContent = targetMet
        ? 'Review any explanations you missed, then continue to Processing and Decalcification or open My Progress to see this attempt in context.'
        : 'Use the explanations above to revisit weak points and retry when ready. You can also open My Progress or preview the next Processing lesson when you want to move on.';
    }
    panel.hidden = false;
  }

  window.addEventListener('htl:quiz-graded', (event) => render(event.detail));
  window.addEventListener('htl:quiz-reset', () => {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.hidden = true;
  });
})();
