(() => {
  'use strict';

  const auth = window.FreeHTLAuth;
  const page = document.body?.dataset.authPage;
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  const targetPage = page === 'sign-in'
    ? 'sign-up.html'
    : page === 'sign-up'
      ? 'sign-in.html'
      : null;

  if (!auth?.safeNext || !requestedNext || !targetPage) return;

  const safeNext = auth.safeNext(requestedNext);
  const expectedTarget = new URL(targetPage, window.location.href);

  document.querySelectorAll('a').forEach((link) => {
    try {
      const candidate = new URL(link.href, window.location.href);
      if (candidate.origin !== expectedTarget.origin || candidate.pathname !== expectedTarget.pathname) return;
      candidate.searchParams.set('next', safeNext);
      link.href = candidate.href;
    } catch {
      // Ignore malformed/non-navigation links; auth.safeNext remains the redirect authority.
    }
  });
})();
