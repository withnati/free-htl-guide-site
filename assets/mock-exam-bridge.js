(() => {
  'use strict';
  const button = document.createElement('button');
  button.type = 'button';
  button.hidden = true;
  button.dataset.grade = 'htl-mock-50';
  button.dataset.mockGradeBridge = 'true';
  document.body.appendChild(button);

  const result = document.createElement('div');
  result.id = 'quizResult';
  result.className = 'quiz-result';
  result.hidden = true;
  document.body.appendChild(result);
})();
