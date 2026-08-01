(() => {
  'use strict';

  const page = document.body;
  const contentId = page.dataset.protectedContentId || '';
  const auth = window.FreeHTLAuth;
  const config = window.FreeHTLSupabaseConfig;

  const statePanel = document.querySelector('[data-premium-state]');
  const message = document.querySelector('[data-premium-message]');
  const statusLabel = document.querySelector('[data-premium-status-label]');
  const actions = document.querySelector('[data-premium-actions]');
  const signIn = document.querySelector('[data-premium-sign-in]');
  const upgrade = document.querySelector('[data-premium-upgrade]');
  const retry = document.querySelector('[data-premium-retry]');
  const requestReference = document.querySelector('[data-premium-request-reference]');
  const content = document.querySelector('[data-premium-content]');
  const contentTitle = document.querySelector('[data-premium-title]');
  const contentSummary = document.querySelector('[data-premium-summary]');
  const contentSections = document.querySelector('[data-premium-sections]');
  const loader = document.querySelector('.premium-loader');

  function signInUrl() {
    const url = new URL('../account/sign-in.html', window.location.href);
    url.searchParams.set('next', window.location.href);
    return url.href;
  }

  function resetActions() {
    if (actions) actions.hidden = false;
    if (signIn) signIn.hidden = true;
    if (upgrade) upgrade.hidden = true;
    if (retry) retry.hidden = true;
  }

  function setRequestReference(requestId) {
    if (!requestReference) return;
    if (!requestId) {
      requestReference.hidden = true;
      requestReference.textContent = '';
      return;
    }
    requestReference.hidden = false;
    requestReference.textContent = `Support reference: ${requestId}`;
  }

  function setState(name, text, options = {}) {
    if (statePanel) statePanel.dataset.state = name;
    if (message) {
      message.textContent = text;
      message.setAttribute('role', options.alert ? 'alert' : 'status');
      message.setAttribute('aria-live', options.alert ? 'assertive' : 'polite');
    }
    if (statusLabel) statusLabel.textContent = options.label || name;
    if (loader) loader.hidden = name !== 'loading';
    if (content) content.hidden = name !== 'authorized';
    resetActions();
    setRequestReference(options.requestId || '');

    if (name === 'signed-out' || name === 'expired') {
      if (signIn) {
        signIn.hidden = false;
        signIn.href = signInUrl();
      }
    }
    if (name === 'upgrade-required' && upgrade) upgrade.hidden = false;
    if (name === 'error' && retry) retry.hidden = false;
  }

  function validText(value, maximum = 5000) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.schemaVersion !== 1) return false;
    if (payload.contentId !== contentId) return false;
    if (!validText(payload.title, 200)) return false;
    if (payload.summary != null && !validText(payload.summary, 1000)) return false;
    if (!Array.isArray(payload.sections) || payload.sections.length > 40) return false;
    return payload.sections.every((section) => {
      if (!section || typeof section !== 'object' || !validText(section.heading, 200)) return false;
      if (section.paragraphs != null && (
        !Array.isArray(section.paragraphs)
        || section.paragraphs.length > 30
        || !section.paragraphs.every((item) => validText(item, 5000))
      )) return false;
      if (section.bullets != null && (
        !Array.isArray(section.bullets)
        || section.bullets.length > 50
        || !section.bullets.every((item) => validText(item, 1000))
      )) return false;
      return true;
    });
  }

  function renderPayload(payload) {
    if (!contentTitle || !contentSummary || !contentSections) return;
    contentTitle.textContent = payload.title;
    contentSummary.textContent = payload.summary || '';
    contentSections.replaceChildren();

    for (const section of payload.sections) {
      const card = document.createElement('section');
      card.className = 'card premium-content-section';

      const heading = document.createElement('h3');
      heading.textContent = section.heading;
      card.append(heading);

      for (const paragraph of section.paragraphs || []) {
        const element = document.createElement('p');
        element.textContent = paragraph;
        card.append(element);
      }

      if (section.bullets?.length) {
        const list = document.createElement('ul');
        list.className = 'premium-content-list';
        for (const bullet of section.bullets) {
          const item = document.createElement('li');
          item.textContent = bullet;
          list.append(item);
        }
        card.append(list);
      }

      contentSections.append(card);
    }
  }

  async function responseBody(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function loadProtectedContent() {
    setState('loading', 'Checking your account session and protected-content access.', {
      label: 'Checking…'
    });

    if (!auth || auth.initializationError || !config?.projectUrl || !config?.publishableKey) {
      setState('error', 'The protected-content service could not be initialized. Please try again later.', {
        label: 'Unavailable',
        alert: true
      });
      return;
    }

    let session;
    try {
      session = await auth.ready;
    } catch {
      setState('error', 'The account service could not be reached. Check your connection and try again.', {
        label: 'Connection problem',
        alert: true
      });
      return;
    }

    if (!session?.access_token) {
      setState('signed-out', 'Sign in with a verified learner account before requesting this protected lesson.', {
        label: 'Sign in required'
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${config.projectUrl}/functions/v1/premium-content`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: config.publishableKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contentId })
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      setState(
        'error',
        timedOut
          ? 'The protected-content request timed out. Please try again.'
          : 'The protected-content service could not be reached. Check your connection and try again.',
        { label: timedOut ? 'Timed out' : 'Connection problem', alert: true }
      );
      return;
    } finally {
      window.clearTimeout(timeout);
    }

    const payload = await responseBody(response);
    const requestId = typeof payload.requestId === 'string'
      ? payload.requestId
      : response.headers.get('X-FHL-Request-Id') || '';

    if (response.status === 401) {
      setState('expired', 'Your account session is missing, invalid, or expired. Sign in again to continue.', {
        label: 'Session expired',
        requestId
      });
      return;
    }

    if (response.status === 403 && payload.code === 'upgrade_required') {
      setState('upgrade-required', 'Your account is verified, but it does not currently include this premium lesson.', {
        label: 'Premium required',
        requestId
      });
      return;
    }

    if (!response.ok) {
      setState('error', 'Protected content is temporarily unavailable. Please try again without changing your account or progress.', {
        label: 'Temporary problem',
        requestId,
        alert: true
      });
      return;
    }

    if (!validatePayload(payload)) {
      setState('error', 'The protected lesson response was not in the expected format. No content was saved.', {
        label: 'Invalid response',
        requestId,
        alert: true
      });
      return;
    }

    renderPayload(payload);
    setState('authorized', 'Your account and premium entitlement were verified. The protected lesson is ready.', {
      label: 'Access granted',
      requestId
    });
    window.requestAnimationFrame(() => contentTitle?.focus());
  }

  retry?.addEventListener('click', loadProtectedContent);
  auth?.onAuthStateChange?.((_event, session) => {
    if (!session) {
      setState('signed-out', 'Sign in with a verified learner account before requesting this protected lesson.', {
        label: 'Sign in required'
      });
    }
  });

  loadProtectedContent();
})();
