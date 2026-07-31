(() => {
  'use strict';
  const ui = window.FreeHTLMockExamUI;
  const controller = window.FreeHTLMockExamController;

  ui.$('#examSetupForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = new FormData(event.currentTarget).get('examMode') || 'timed';
    controller.start(String(mode));
  });

  ui.refs.resume?.addEventListener('click', () => controller.resume());
  ui.refs.grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-question-index]');
    if (button) controller.move(Number(button.dataset.questionIndex));
  });
  ui.refs.form?.addEventListener('change', (event) => {
    if (event.target.matches('input[type="radio"]')) controller.respond(event.target);
  });

  ui.$('[data-previous-question]')?.addEventListener('click', () => {
    const attempt = controller.getAttempt();
    if (attempt) controller.move(attempt.currentIndex - 1);
  });
  ui.$('[data-next-question]')?.addEventListener('click', () => {
    const attempt = controller.getAttempt();
    if (attempt) controller.move(attempt.currentIndex + 1);
  });
  ui.refs.flag?.addEventListener('click', () => controller.toggleFlag());
  ui.$('[data-show-unanswered]')?.addEventListener('click', () => controller.firstUnanswered());

  ui.$('[data-submit-exam]')?.addEventListener('click', () => {
    const count = controller.unansweredCount();
    if (count) {
      ui.refs.warningCount.textContent = String(count);
      ui.refs.warning.hidden = false;
      ui.refs.warning.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else controller.finish(false);
  });
  ui.$('[data-submit-anyway]')?.addEventListener('click', () => controller.finish(false));
  ui.$('[data-new-exam]')?.addEventListener('click', () => controller.reset());
  ui.$('[data-clear-history]')?.addEventListener('click', () => controller.clearHistory());

  ui.$('[data-toggle-review]')?.addEventListener('click', (event) => {
    const hidden = ui.refs.review.hidden;
    ui.refs.review.hidden = !hidden;
    event.currentTarget.setAttribute('aria-expanded', String(hidden));
    event.currentTarget.textContent = hidden ? 'Hide review' : 'Show review';
  });

  window.FreeHTLMockExamBank.load().then((bank) => {
    controller.setBank(bank);
    document.body.dataset.mockExamLoaded = 'true';
  }).catch((error) => {
    ui.refs.status.textContent = 'Question bank unavailable';
    ui.refs.status.classList.add('error');
    const message = ui.$('[data-exam-error]');
    if (message) {
      message.hidden = false;
      message.textContent = error.message;
    }
    document.body.dataset.mockExamLoaded = 'false';
  });

  window.FreeHTLMockExam = controller;
})();
