(() => {
  'use strict';

  const script = [...document.scripts].find((item) => /\/premium-ui\.js(?:\?|$)/.test(item.src));
  const rootUrl = script ? new URL('../', script.src) : new URL('./', window.location.href);
  const auth = window.FreeHTLAuth;
  const billing = window.FreeHTLBilling;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  function siteUrl(path) {
    return new URL(path.replace(/^\//, ''), rootUrl).href;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  }

  function setVisible(selector, visible) {
    document.querySelectorAll(selector).forEach((node) => { node.hidden = !visible; });
  }

  function replaceAccountLinks(state) {
    const signInLinks = [...document.querySelectorAll('a')].filter((link) =>
      /\/account\/sign-in\.html(?:$|[?#])/.test(link.href)
    );
    const signUpLinks = [...document.querySelectorAll('a')].filter((link) =>
      /\/account\/sign-up\.html(?:$|[?#])/.test(link.href)
    );
    if (state === 'signed-out' || state === 'error') return;

    signInLinks.forEach((link) => {
      link.href = siteUrl('account/settings.html');
      link.textContent = 'Account';
    });
    if (state === 'offline') {
      signUpLinks.forEach((link) => { link.hidden = true; });
      return;
    }
    signUpLinks.forEach((link) => {
      const premium = state === 'premium' || state === 'attention';
      link.href = siteUrl(premium ? 'premium/index.html' : 'pricing.html');
      link.textContent = premium ? 'Premium library' : 'View Premium';
      link.classList.toggle('premium-account-link', premium);
    });
  }

  function applyHomeState(state) {
    const premium = state === 'premium' || state === 'attention';
    if (premium) {
      setText('[data-premium-availability]', state === 'attention'
        ? 'Your Premium access is active. Review your billing status to avoid an interruption.'
        : 'Your Premium access is active. Continue with the course and study tools included in your account.');
      setText('[data-premium-path-copy]', 'Use your Premium access for the complete course, practice, mock exams, Targeted Practice, attempt history, and focused review.');
      setText('[data-premium-course-intro]', 'Your Premium account includes the remaining lessons and preparation tools. Open a lesson or tool to continue.');
      document.querySelectorAll('[data-premium-route-link]').forEach((link) => {
        link.textContent = link.dataset.premiumLabel || 'Open Premium';
      });
      setVisible('[data-premium-library-action]', true);
      return;
    }
    if (state === 'free') {
      setText('[data-premium-availability]', 'You are signed in with a free account. Premium enrollment is open when you are ready for the complete course and practice system.');
      setText('[data-premium-path-copy]', 'Premium adds the full course, expanded practice, mock exams, Targeted Practice, attempt history, and weak-domain recommendations.');
      setText('[data-premium-course-intro]', 'Begin with the complete free Fixation lesson, then compare Premium for the remaining lessons and preparation tools.');
      return;
    }
    if (state === 'ended') {
      setText('[data-premium-availability]', 'Your previous Premium access has ended. Your account and eligible learning history are still available.');
      return;
    }
    if (state === 'error') {
      setText('[data-premium-availability]', 'We could not confirm your account access. Free study remains available; refresh to check Premium again.');
    } else if (state === 'offline') {
      setText('[data-premium-availability]', 'You are offline. Free study remains available; reconnect to confirm your Premium access.');
    }
    setVisible('[data-premium-library-action]', false);
  }

  function applyPreviewState(state) {
    const premium = state === 'premium' || state === 'attention';
    const title = document.querySelector('h1')?.textContent?.trim() || 'this Premium feature';
    if (premium) {
      setText('[data-premium-preview-label]', state === 'attention' ? 'Premium access · Billing attention' : 'Premium access confirmed');
      setText('[data-premium-preview-message]', `Your account includes ${title}.`);
      setText('[data-premium-preview-detail]', document.querySelector('[data-protected-preview-link]')
        ? 'Open the securely delivered lesson preview below. The complete lesson will be added here as its protected release is completed.'
        : 'This feature is included with your account and is being prepared for secure release. Your access will appear here automatically when it is available.');
      setVisible('[data-premium-upgrade-action]', false);
      setVisible('[data-premium-account-action]', true);
      setVisible('[data-protected-preview-link]', true);
      return;
    }
    if (state === 'signed-out') {
      setText('[data-premium-preview-label]', 'Premium preview');
      setText('[data-premium-preview-message]', `${title} is included with Premium.`);
      setText('[data-premium-preview-detail]', 'Sign in to confirm your account access, or compare Premium plans before enrolling.');
      setVisible('[data-premium-upgrade-action]', true);
      setVisible('[data-premium-account-action]', false);
      setVisible('[data-protected-preview-link]', false);
      return;
    }
    if (state === 'free' || state === 'ended') {
      setText('[data-premium-preview-label]', 'Included with Premium');
      setText('[data-premium-preview-message]', `${title} is included with Premium.`);
      setText('[data-premium-preview-detail]', state === 'ended'
        ? 'Your previous Premium access has ended. Compare plans to restore access while keeping your account and eligible learning history.'
        : 'Compare Premium plans for the complete course, practice system, and account-linked progress tools.');
      setVisible('[data-premium-upgrade-action]', true);
      setVisible('[data-premium-account-action]', false);
      setVisible('[data-protected-preview-link]', false);
      return;
    }
    if (state === 'error') {
      setText('[data-premium-preview-label]', 'Access check unavailable');
      setText('[data-premium-preview-message]', 'We could not confirm your Premium access.');
      setText('[data-premium-preview-detail]', 'Refresh the page to try again. You can also review your plan from the account page.');
      setVisible('[data-premium-upgrade-action]', false);
      setVisible('[data-premium-account-action]', true);
      setVisible('[data-protected-preview-link]', false);
      return;
    }
    if (state === 'offline') {
      setText('[data-premium-preview-label]', 'Offline');
      setText('[data-premium-preview-message]', `Reconnect to confirm access to ${title}.`);
      setText('[data-premium-preview-detail]', 'This feature stays securely locked until the server can check your account again. Your account has not been changed.');
      setVisible('[data-premium-upgrade-action]', false);
      setVisible('[data-premium-account-action]', true);
      setVisible('[data-protected-preview-link]', false);
    }
  }

  function projectState(status) {
    if (status.premiumAccess === true) {
      return status.state === 'past_due' || status.state === 'grace' ? 'attention' : 'premium';
    }
    return status.state === 'free' ? 'free' : 'ended';
  }

  function applyHubState(state) {
    const premium = state === 'premium' || state === 'attention';
    setVisible('[data-premium-hub-library]', premium);
    setVisible('[data-premium-hub-sign-in]', state === 'signed-out');
    setVisible('[data-premium-hub-upgrade]', state === 'free' || state === 'ended');
    setVisible('[data-premium-hub-error]', state === 'error' || state === 'offline');
    setVisible('[data-premium-hub-error-plan]', state === 'error');
    if (premium) {
      setText('[data-premium-hub-label]', state === 'attention' ? 'Premium access · Billing attention' : 'Premium access confirmed');
      setText('[data-premium-hub-message]', state === 'attention'
        ? 'Your Premium learning library is available. Review billing soon to avoid an interruption.'
        : 'Your Premium learning library is ready. Continue with available secure lessons and track what is coming next.');
      setVisible('[data-premium-hub-loading]', false);
      return;
    }
    if (state === 'signed-out') {
      setText('[data-premium-hub-label]', 'Sign in required');
      setText('[data-premium-hub-message]', 'Sign in to confirm the Premium access attached to your account.');
    } else if (state === 'free') {
      setText('[data-premium-hub-label]', 'Free account');
      setText('[data-premium-hub-message]', 'Your account is active, but it does not currently include Premium learning access.');
    } else if (state === 'ended') {
      setText('[data-premium-hub-label]', 'Premium ended');
      setText('[data-premium-hub-message]', 'Your Premium access has ended. Your account and eligible study history remain available.');
    } else if (state === 'error') {
      setText('[data-premium-hub-label]', 'Access check unavailable');
      setText('[data-premium-hub-message]', 'We could not confirm your Premium access. Refresh the page or review your account status.');
      setText('[data-premium-hub-gate-label]', 'Access check unavailable');
      setText('[data-premium-hub-gate-heading]', 'Your account has not been changed');
      setText('[data-premium-hub-gate-message]', 'Try the access check again, or review your plan from account settings. Free study remains available.');
    } else if (state === 'offline') {
      setText('[data-premium-hub-label]', 'Offline');
      setText('[data-premium-hub-message]', 'Reconnect to securely confirm your Premium library access.');
      setText('[data-premium-hub-gate-label]', 'Offline');
      setText('[data-premium-hub-gate-heading]', 'Reconnect to confirm your library');
      setText('[data-premium-hub-gate-message]', 'Premium lessons stay securely locked while offline. Your account and access have not been changed.');
    }
    setVisible('[data-premium-hub-loading]', false);
  }

  function applyDashboardState(state) {
    const premium = state === 'premium' || state === 'attention';
    if (!premium) return;
    setText('[data-dashboard-account-heading]', state === 'attention' ? 'Premium access needs attention' : 'Premium learning account');
    setText('[data-dashboard-account-copy]', state === 'attention'
      ? 'Your Premium tools remain available. Review billing soon to avoid an interruption.'
      : 'Your account includes Premium lessons and study tools. Open the Premium library to continue.');
    setText('[data-account-status]', 'Premium learner account');
    setText('[data-access-status]', 'Premium content');
    setText('[data-dashboard-access-note]', 'Premium access is confirmed from trusted account records. Protected lesson and question content is still authorized by the server when opened.');
    document.querySelectorAll('[data-premium-dashboard-continue]').forEach((link) => {
      link.href = siteUrl('premium/index.html');
      link.textContent = 'Open Premium library';
    });
  }

  function applyState(state, status = null) {
    document.body.dataset.premiumUiState = state;
    replaceAccountLinks(state);
    if (document.querySelector('[data-premium-availability]')) applyHomeState(state);
    if (document.body.dataset.page === 'premium-preview') applyPreviewState(state);
    if (document.body.dataset.page === 'premium-hub') applyHubState(state);
    if (document.body.dataset.page === 'my-progress') applyDashboardState(state);
    const detail = { state, status };
    window.dispatchEvent(new CustomEvent('fhl:premium-ui-ready', { detail }));
    resolveReady(detail);
  }

  async function initialize() {
    document.body.dataset.premiumUiState = 'loading';
    if (!auth || !billing) return applyState('error');
    try {
      const session = await auth.ready;
      if (!session) return applyState('signed-out');
      const result = await billing.getSubscriptionStatus();
      if (result.requiresSignIn) return applyState('signed-out');
      if (result.error || !result.data) throw result.error || new Error('Premium status unavailable.');
      applyState(projectState(result.data), result.data);
    } catch {
      applyState(navigator.onLine === false ? 'offline' : 'error');
    }
  }

  window.FreeHTLPremiumUI = Object.freeze({ ready, siteUrl });
  document.querySelector('[data-premium-hub-retry]')?.addEventListener('click', () => window.location.reload());
  initialize();
})();
