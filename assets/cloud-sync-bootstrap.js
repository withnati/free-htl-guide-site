(() => {
  'use strict';

  const currentScript = document.currentScript;
  const assetRoot = currentScript ? new URL('./', currentScript.src) : new URL('assets/', window.location.href);
  const DECISION_KEY = 'free-htl-cloud-sync-v1';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';
  const state = { status: 'starting', mode: null, userId: null, error: null };
  const statusLabels = {
    starting: 'Connecting account progress…',
    saving: 'Saving progress…',
    saved: 'Saved to your account',
    connected: 'Saved to your account',
    offline: 'Offline — changes are pending on this device',
    error: 'Sync problem — changes are kept on this device',
    conflict: 'A newer session exists on another device. Open My Progress to resolve it.',
    'account-mismatch': 'Cloud sync is paused because a different account is signed in.'
  };

  function readDecision() {
    try {
      const value = JSON.parse(localStorage.getItem(DECISION_KEY) || 'null');
      if (!value || !value.userId || !['imported', 'account-only'].includes(value.mode)) return null;
      return value;
    } catch {
      return null;
    }
  }

  function writeDecision(value) {
    localStorage.setItem(DECISION_KEY, JSON.stringify(value));
  }

  function ensureStyles() {
    if (document.querySelector('link[data-free-htl-cloud-sync-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('cloud-sync.css', assetRoot).href;
    link.dataset.freeHtlCloudSyncStyle = 'true';
    document.head.appendChild(link);
  }

  function indicator() {
    let element = document.querySelector('[data-cloud-sync-indicator]');
    if (element) return element;
    element = document.createElement('div');
    element.className = 'cloud-sync-indicator';
    element.dataset.cloudSyncIndicator = 'true';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.hidden = true;
    document.body?.appendChild(element);
    return element;
  }

  function renderStatus(status, detail = {}) {
    state.status = status;
    state.error = detail.message || detail.error || null;
    document.body?.setAttribute('data-cloud-progress', status);
    const element = indicator();
    const label = statusLabels[status];
    if (!label || ['local', 'signed-out'].includes(status)) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    element.dataset.state = status;
    element.textContent = label;
  }

  function emit(status, detail = {}) {
    Object.assign(state, detail);
    renderStatus(status, detail);
    window.dispatchEvent(new CustomEvent('htl:cloud-sync-state', {
      detail: { status, mode: state.mode, userId: state.userId, error: state.error, ...detail }
    }));
  }

  window.addEventListener('htl:cloud-sync-state', (event) => {
    if (!event.detail?.status) return;
    Object.assign(state, event.detail);
    renderStatus(event.detail.status, event.detail);
  });

  function loadScript(src, marker) {
    if (marker?.()) return Promise.resolve();
    const existing = [...document.scripts].find((item) => item.src === src);
    if (existing) {
      if (marker?.()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.freeHtlCloudDependency = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function loadDependencies() {
    await loadScript(SDK_URL, () => Boolean(window.supabase?.createClient));
    await loadScript(new URL('supabase-config.js', assetRoot).href, () => Boolean(window.FreeHTLSupabaseConfig));
    await loadScript(new URL('auth-service.js', assetRoot).href, () => Boolean(window.FreeHTLAuth));
    await loadScript(new URL('cloud-progress-adapter.js', assetRoot).href, () => Boolean(window.FreeHTLCloudProgressAdapter));
    await loadScript(new URL('resilient-cloud-adapter.js', assetRoot).href, () => Boolean(window.FreeHTLResilientCloudAdapter));
  }

  async function initialize() {
    const decision = readDecision();
    if (!decision) {
      emit('local');
      return;
    }

    ensureStyles();
    emit('starting');
    state.mode = decision.mode;
    state.userId = decision.userId;
    await loadDependencies();

    const service = window.FreeHTLProgress;
    const auth = window.FreeHTLAuth;
    const cloud = window.FreeHTLCloudProgressAdapter;
    const resilience = window.FreeHTLResilientCloudAdapter;
    if (!service || !auth || !cloud || !resilience) throw new Error('Cloud progress dependencies are unavailable.');

    await service.ready;
    const session = await auth.ready;
    if (!session?.user?.id) {
      emit('signed-out');
      return;
    }
    if (session.user.id !== decision.userId) {
      emit('account-mismatch');
      return;
    }

    const localRecord = await service.getSnapshot();
    const baseAdapter = new cloud.CloudProgressAdapter(auth.client, session.user.id, {
      schemaVersion: localRecord.schemaVersion
    });
    const adapter = new resilience.ResilientCloudAdapter(baseAdapter);

    if (decision.mode === 'imported') {
      const localUpdatedAt = Date.parse(localRecord.updatedAt || 0);
      const lastLocalSyncAt = Date.parse(decision.lastLocalSyncAt || 0);
      if (Number.isFinite(localUpdatedAt) && localUpdatedAt > lastLocalSyncAt) {
        const remoteRecord = await adapter.load();
        const mergedRecord = cloud.mergeRecords(remoteRecord, localRecord, session.user.id);
        await adapter.save(mergedRecord);
        writeDecision({
          ...decision,
          lastLocalSyncAt: localRecord.updatedAt,
          refreshedAt: new Date().toISOString()
        });
      }
    }

    await service.useAdapter(adapter);
    emit(adapter.hasPending() ? 'offline' : 'connected', {
      mode: decision.mode,
      userId: session.user.id,
      error: null,
      pending: adapter.hasPending()
    });
  }

  const ready = initialize().catch((error) => {
    console.error(error);
    state.error = error.message || 'Cloud synchronization failed.';
    emit(navigator.onLine ? 'error' : 'offline', { error: state.error, message: state.error });
  });

  window.FreeHTLCloudSync = Object.freeze({ ready, state, decisionKey: DECISION_KEY });
})();
