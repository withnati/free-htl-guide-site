(() => {
  'use strict';

  const currentScript = document.currentScript;
  const assetRoot = currentScript ? new URL('./', currentScript.src) : new URL('assets/', window.location.href);
  const DECISION_KEY = 'free-htl-cloud-sync-v1';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8';
  const state = { status: 'starting', mode: null, userId: null, error: null };

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

  function emit(status, detail = {}) {
    state.status = status;
    Object.assign(state, detail);
    document.body?.setAttribute('data-cloud-progress', status);
    window.dispatchEvent(new CustomEvent('htl:cloud-sync-state', {
      detail: { status, mode: state.mode, userId: state.userId, error: state.error }
    }));
  }

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
  }

  async function initialize() {
    const decision = readDecision();
    if (!decision) {
      emit('local');
      return;
    }

    state.mode = decision.mode;
    state.userId = decision.userId;
    await loadDependencies();

    const service = window.FreeHTLProgress;
    const auth = window.FreeHTLAuth;
    const cloud = window.FreeHTLCloudProgressAdapter;
    if (!service || !auth || !cloud) throw new Error('Cloud progress dependencies are unavailable.');

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
    const adapter = new cloud.CloudProgressAdapter(auth.client, session.user.id, {
      schemaVersion: localRecord.schemaVersion
    });

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
    emit('connected', { mode: decision.mode, userId: session.user.id, error: null });
  }

  const ready = initialize().catch((error) => {
    console.error(error);
    state.error = error.message || 'Cloud synchronization failed.';
    emit(navigator.onLine ? 'error' : 'offline', { error: state.error });
  });

  window.FreeHTLCloudSync = Object.freeze({ ready, state, decisionKey: DECISION_KEY });
})();