(() => {
  'use strict';

  const page = document.body;
  const contentId = page.dataset.protectedContentId || '';
  const contentLabel = page.dataset.protectedContentLabel === 'study plan' ? 'study plan' : 'lesson';
  const auth = window.FreeHTLAuth;
  const config = window.FreeHTLSupabaseConfig;
  const progress = window.FreeHTLProgress;

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
  const taskStatus = document.querySelector('[data-premium-task-status]');
  const loader = document.querySelector('.premium-loader');
  const OFFLINE_MESSAGE = `You are offline. Reconnect, then try again to securely open this ${contentLabel}.`;

  function signInUrl() {
    const url = new URL('../account/sign-in.html', window.location.href);
    url.searchParams.set('next', `${window.location.origin}${window.location.pathname}`);
    return url.href;
  }

  function clearRenderedPayload() {
    if (contentTitle) contentTitle.textContent = '';
    if (contentSummary) contentSummary.textContent = '';
    contentSections?.replaceChildren();
    if (taskStatus) {
      taskStatus.hidden = true;
      taskStatus.textContent = '';
    }
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
    page.dataset.premiumContentState = name;
    if (statePanel) {
      statePanel.dataset.state = name;
      statePanel.setAttribute('aria-busy', String(name === 'loading'));
    }
    if (message) {
      message.textContent = text;
      message.setAttribute('role', options.alert ? 'alert' : 'status');
      message.setAttribute('aria-live', options.alert ? 'assertive' : 'polite');
    }
    if (statusLabel) statusLabel.textContent = options.label || name;
    if (loader) loader.hidden = name !== 'loading';
    if (content) content.hidden = name !== 'authorized';
    if (name !== 'authorized') clearRenderedPayload();
    resetActions();
    setRequestReference(options.requestId || '');

    if (name === 'signed-out' || name === 'expired') {
      if (signIn) {
        signIn.hidden = false;
        signIn.href = signInUrl();
        signIn.textContent = name === 'expired' ? 'Sign in again' : 'Sign in to continue';
      }
    }
    if (name === 'upgrade-required' && upgrade) upgrade.hidden = false;
    if ((name === 'error' || name === 'offline') && retry) retry.hidden = false;
  }

  function setConnectionFailure(error = null) {
    const offline = navigator.onLine === false;
    const timedOut = error?.name === 'AbortError';
    const text = offline
      ? OFFLINE_MESSAGE
      : timedOut
        ? `This ${contentLabel} took too long to load. Please try again. Your progress has not been changed.`
        : `We could not load this ${contentLabel}. Check your connection and try again. Your progress has not been changed.`;
    const label = offline ? 'Offline' : timedOut ? 'Timed out' : 'Connection problem';
    setState(offline ? 'offline' : 'error', text, { label, alert: true });
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
      if (section.tasks != null && (
        !Array.isArray(section.tasks)
        || section.tasks.length > 50
        || !section.tasks.every((item) => (
          item
          && typeof item === 'object'
          && /^[a-z0-9-]{1,80}$/.test(item.id)
          && validText(item.text, 1000)
        ))
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
      if (section.tasks?.length) {
        const list = document.createElement('ul');
        list.className = 'premium-task-list';
        for (const task of section.tasks) {
          const item = document.createElement('li');
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.premiumTaskId = task.id;
          label.append(checkbox, document.createTextNode(task.text));
          item.append(label);
          list.append(item);
        }
        card.append(list);
      }
      contentSections.append(card);
    }
  }

  function setTaskStatus(text, tone = 'info') {
    if (!taskStatus) return;
    taskStatus.hidden = false;
    taskStatus.textContent = text;
    taskStatus.dataset.tone = tone;
  }

  async function connectStudyTasks() {
    const boxes = [...document.querySelectorAll('[data-premium-task-id]')];
    if (!boxes.length || !taskStatus) return;
    if (!progress) {
      boxes.forEach((box) => { box.disabled = true; });
      setTaskStatus('Task progress is temporarily unavailable. The study plan remains readable.', 'warn');
      return;
    }

    try {
      setTaskStatus('Connecting your task progress…');
      await progress.ready;
      if (window.FreeHTLCloudSync?.ready) await window.FreeHTLCloudSync.ready;
      const snapshot = await progress.getSnapshot();
      boxes.forEach((box) => {
        const taskId = box.dataset.premiumTaskId;
        const saved = snapshot.studyTasks?.[`${contentId}:${taskId}`];
        box.checked = Boolean(saved?.checked);
        box.addEventListener('change', async () => {
          const nextChecked = box.checked;
          box.disabled = true;
          setTaskStatus('Saving task progress…');
          try {
            await progress.recordStudyTask({ page: contentId, taskId, checked: nextChecked });
            setTaskStatus('Task progress saved to your learning record.');
          } catch (error) {
            console.error(error);
            box.checked = !nextChecked;
            setTaskStatus('We could not save that task yet. Your previous progress is unchanged.', 'warn');
          } finally {
            box.disabled = false;
          }
        });
      });
      setTaskStatus('Task progress is connected to your learning record.');
    } catch (error) {
      console.error(error);
      boxes.forEach((box) => { box.disabled = true; });
      setTaskStatus('Task progress is temporarily unavailable. The study plan remains readable.', 'warn');
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
    setState('loading', `Loading your ${contentLabel}…`, { label: 'Loading…' });

    if (!auth || auth.initializationError || !config?.projectUrl || !config?.publishableKey) {
      setState('error', `We could not load this ${contentLabel}. Please try again later. Your progress has not been changed.`, {
        label: `Could not load ${contentLabel}`, alert: true
      });
      return;
    }

    let session;
    try {
      session = await auth.ready;
    } catch {
      setConnectionFailure();
      return;
    }

    if (!session?.access_token) {
      setState('signed-out', 'Sign in to continue learning.', { label: 'Sign in required' });
      return;
    }

    if (navigator.onLine === false) {
      setState('offline', OFFLINE_MESSAGE, {
        label: 'Offline', alert: true
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${config.projectUrl}/functions/v1/premium-content`, {
        method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId })
      });
    } catch (error) {
      setConnectionFailure(error);
      return;
    } finally {
      window.clearTimeout(timeout);
    }

    const payload = await responseBody(response);
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : response.headers.get('X-FHL-Request-Id') || '';

    if (response.status === 401) {
      setState('expired', 'Your session ended. Sign in again to continue.', { label: 'Sign in again', requestId });
      return;
    }

    if (response.status === 403 && payload.code === 'upgrade_required') {
      setState('upgrade-required', `This ${contentLabel} is included with Premium. See what Premium includes to continue preparing.`, {
        label: 'Included with Premium', requestId
      });
      return;
    }

    if (!response.ok) {
      setState('error', `We could not load this ${contentLabel}. Please try again. Your progress has not been changed.`, {
        label: `Could not load ${contentLabel}`, requestId, alert: true
      });
      return;
    }

    if (!validatePayload(payload)) {
      setState('error', `We could not load this ${contentLabel}. Please try again. Your progress has not been changed.`, {
        label: `Could not load ${contentLabel}`, requestId, alert: true
      });
      return;
    }

    renderPayload(payload);
    setState('authorized', `Your ${contentLabel} is ready.`, {
      label: contentLabel === 'lesson' ? 'Lesson ready' : 'Study plan ready', requestId
    });
    await connectStudyTasks();
    window.requestAnimationFrame(() => contentTitle?.focus());
  }

  retry?.addEventListener('click', loadProtectedContent);
  auth?.onAuthStateChange?.((_event, session) => {
    if (!session) setState('signed-out', 'Sign in to continue learning.', { label: 'Sign in required' });
  });
  loadProtectedContent();
})();
