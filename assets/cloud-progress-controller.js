(() => {
  'use strict';

  const service = window.FreeHTLProgress;
  const auth = window.FreeHTLAuth;
  const cloud = window.FreeHTLCloudProgressAdapter;
  const resilience = window.FreeHTLResilientCloudAdapter;
  const $ = (selector) => document.querySelector(selector);
  const status = $('[data-progress-status]');
  const importPanel = $('[data-cloud-import]');
  const importSummary = $('[data-cloud-import-summary]');
  const importButton = $('[data-import-progress]');
  const accountOnlyButton = $('[data-account-progress-only]');
  const conflictPanel = $('[data-cloud-conflict]');
  const conflictSummary = $('[data-cloud-conflict-summary]');
  const useCloudSessionButton = $('[data-use-cloud-session]');
  const useDeviceSessionButton = $('[data-use-device-session]');
  const anonymousActions = $('[data-anonymous-account-actions]');
  const authenticatedActions = $('[data-authenticated-account-actions]');
  const accountEmail = $('[data-cloud-account-email]');
  const DECISION_KEY = 'free-htl-cloud-sync-v1';
  let adapter = null;
  let browserRecord = null;
  let userId = null;
  let lastSyncStatus = 'local';

  function setStatus(message, tone = 'info', focus = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.classList.toggle('warn', tone === 'warn');
    if (focus) status.focus();
  }

  function setBusy(busy) {
    [importButton, accountOnlyButton, useCloudSessionButton, useDeviceSessionButton]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = busy;
        button.setAttribute('aria-busy', busy ? 'true' : 'false');
      });
  }

  function readDecision(expectedUserId) {
    try {
      const value = JSON.parse(localStorage.getItem(DECISION_KEY) || 'null');
      if (!value || value.userId !== expectedUserId) return null;
      if (!['imported', 'account-only'].includes(value.mode)) return null;
      return value;
    } catch {
      return null;
    }
  }

  function saveDecision(mode) {
    if (!userId || !['imported', 'account-only'].includes(mode)) return;
    const value = {
      userId,
      mode,
      decidedAt: new Date().toISOString()
    };
    if (mode === 'imported' && browserRecord?.updatedAt) value.lastLocalSyncAt = browserRecord.updatedAt;
    localStorage.setItem(DECISION_KEY, JSON.stringify(value));
  }

  function countSummary(counts) {
    const parts = [
      [counts.modules, 'module record'],
      [counts.studyTasks, 'study task'],
      [counts.quizAttempts, 'quiz attempt'],
      [counts.mockAttempts, 'mock-exam attempt'],
      [counts.targetedAttempts, 'targeted-practice attempt'],
      [counts.activeSessions, 'unfinished session']
    ].filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}${count === 1 ? '' : 's'}`);
    return parts.length ? parts.join(', ') : 'a browser progress record';
  }

  function syncMessage(syncStatus) {
    const values = {
      saving: ['Saving progress to your account…', 'info'],
      saved: ['Progress is saved to your account.', 'info'],
      offline: ['Offline — changes are preserved on this device and will retry when cloud access returns.', 'warn'],
      error: ['Cloud sync has a problem. Changes are preserved on this device for retry.', 'warn'],
      conflict: ['A newer unfinished session exists on another device. Your current changes were not allowed to overwrite it.', 'warn']
    };
    return values[syncStatus] || null;
  }

  function showConflict(conflict = null) {
    if (!conflictPanel) return;
    const type = conflict?.sessionType === 'targeted-practice' ? 'Targeted Practice' : 'mock exam';
    const updated = conflict?.serverUpdatedAt ? new Date(conflict.serverUpdatedAt) : null;
    const timeText = updated && !Number.isNaN(updated.getTime())
      ? ` The account copy was updated ${updated.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`
      : '';
    conflictSummary.textContent = `A newer unfinished ${type} session is saved in your account.${timeText}`;
    conflictPanel.hidden = false;
    document.body.dataset.cloudProgress = 'conflict';
  }

  function hideConflict() {
    if (conflictPanel) conflictPanel.hidden = true;
  }

  async function connectAccountProgress(message = 'Cloud sync is connected to this verified account. Your browser copy remains available as a recovery backup.') {
    await service.useAdapter(adapter);
    importPanel.hidden = true;
    const conflict = adapter.conflictInfo?.();
    if (conflict) showConflict(conflict);
    if (adapter.hasPending() || ['offline', 'error', 'conflict'].includes(lastSyncStatus)) {
      const current = syncMessage(lastSyncStatus === 'saved' ? 'offline' : lastSyncStatus) || syncMessage('offline');
      setStatus(current[0], current[1], true);
      document.body.dataset.cloudProgress = conflict ? 'conflict' : (lastSyncStatus === 'conflict' ? 'conflict' : 'offline');
      return;
    }
    hideConflict();
    setStatus(message, 'info', true);
    document.body.dataset.cloudProgress = 'connected';
  }

  async function importBrowserProgress() {
    setBusy(true);
    setStatus('Importing and reconciling your browser progress…');
    try {
      await adapter.importRecord(browserRecord);
      saveDecision('imported');
      await connectAccountProgress();
    } catch (error) {
      console.error(error);
      setStatus('Browser progress could not be imported. Nothing was deleted; you can try again.', 'warn', true);
      document.body.dataset.cloudProgress = 'error';
    } finally {
      setBusy(false);
    }
  }

  async function useAccountOnly() {
    setBusy(true);
    setStatus('Loading progress already saved to this account…');
    try {
      saveDecision('account-only');
      await connectAccountProgress('Account progress is connected. This browser’s earlier anonymous record remains separate and unchanged.');
    } catch (error) {
      console.error(error);
      localStorage.removeItem(DECISION_KEY);
      setStatus('Account progress could not be loaded. Your browser progress remains unchanged.', 'warn', true);
      document.body.dataset.cloudProgress = 'error';
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(strategy) {
    if (!adapter?.resolveConflict) return;
    setBusy(true);
    setStatus(strategy === 'remote'
      ? 'Loading the newer account session and preserving unrelated progress…'
      : 'Replacing the conflicting account session with this device’s retained session…');
    try {
      await adapter.resolveConflict(strategy);
      await service.useAdapter(adapter);
      hideConflict();
      lastSyncStatus = 'saved';
      document.body.dataset.cloudProgress = 'connected';
      setStatus(strategy === 'remote'
        ? 'The newer account session is ready to resume. Other progress was preserved.'
        : 'This device’s session replaced the conflicting account session. Other progress was preserved.', 'info', true);
    } catch (error) {
      console.error(error);
      showConflict(adapter.conflictInfo?.());
      setStatus('The session conflict could not be resolved. Both choices remain available and this device’s work is still retained.', 'warn', true);
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    if (!service || !auth || !cloud || !resilience) {
      setStatus('Cloud synchronization is unavailable. Progress remains safely stored in this browser.', 'warn');
      document.body.dataset.cloudProgress = 'unavailable';
      return;
    }

    await service.ready;
    let session;
    try {
      session = await auth.ready;
    } catch (error) {
      console.error(error);
      setStatus('Account services could not be reached. Progress remains stored in this browser.', 'warn');
      document.body.dataset.cloudProgress = 'unavailable';
      return;
    }

    if (!session?.user?.id) {
      anonymousActions.hidden = false;
      authenticatedActions.hidden = true;
      setStatus('Progress is stored in this browser. Sign in or create an account to enable cloud synchronization.');
      document.body.dataset.cloudProgress = 'anonymous';
      return;
    }

    userId = session.user.id;
    anonymousActions.hidden = true;
    authenticatedActions.hidden = false;
    if (accountEmail) accountEmail.textContent = session.user.email || 'Verified learner';
    browserRecord = await service.getSnapshot();
    const baseAdapter = new cloud.CloudProgressAdapter(auth.client, userId, { schemaVersion: browserRecord.schemaVersion });
    adapter = new resilience.ResilientCloudAdapter(baseAdapter);

    const decision = readDecision(userId);
    if (decision) {
      const message = decision.mode === 'imported'
        ? 'Cloud sync is active for this account. Your original browser record remains available as a recovery backup.'
        : 'Cloud sync is active using account progress only. The earlier anonymous browser record remains separate.';
      await connectAccountProgress(message);
      return;
    }

    const [remoteRecord, alreadyImported] = await Promise.all([
      adapter.load(),
      adapter.hasCompletedMigration(browserRecord.recordId)
    ]);
    const browserHasProgress = browserRecord.owner?.kind === 'anonymous' && cloud.hasMeaningfulProgress(browserRecord);
    const remoteHasProgress = cloud.hasMeaningfulProgress(remoteRecord);

    if (alreadyImported) {
      saveDecision('imported');
      await connectAccountProgress();
      return;
    }

    if (browserHasProgress) {
      importSummary.textContent = `${countSummary(cloud.progressCounts(browserRecord))} were found on this browser.${remoteHasProgress ? ' They can be merged with the progress already saved to your account.' : ''}`;
      importPanel.hidden = false;
      setStatus('You are signed in. Choose whether to import this browser’s progress before cloud sync begins.', 'warn');
      document.body.dataset.cloudProgress = 'awaiting-import';
      return;
    }

    saveDecision('account-only');
    await connectAccountProgress('Cloud sync is connected to this account. No earlier anonymous study progress was found on this browser.');
  }

  function isConnected() {
    return Boolean(adapter && userId);
  }

  async function reconnectAfterReset() {
    if (!adapter) return;
    localStorage.removeItem(service.storageKey());
    await service.useAdapter(adapter);
    lastSyncStatus = adapter.hasPending() ? 'offline' : 'saved';
    document.body.dataset.cloudProgress = adapter.hasPending() ? 'offline' : 'connected';
  }

  window.addEventListener('htl:cloud-sync-state', (event) => {
    const syncStatus = event.detail?.status;
    if (!syncStatus) return;
    lastSyncStatus = syncStatus;
    if (syncStatus === 'conflict') showConflict(event.detail.conflict || adapter?.conflictInfo?.());
    if (syncStatus === 'saved' && !adapter?.conflictInfo?.()) hideConflict();
    const current = syncMessage(syncStatus);
    if (!current || document.body.dataset.cloudProgress === 'awaiting-import') return;
    setStatus(current[0], current[1]);
    document.body.dataset.cloudProgress = syncStatus === 'saved' ? 'connected' : syncStatus;
  });

  importButton?.addEventListener('click', () => { void importBrowserProgress(); });
  accountOnlyButton?.addEventListener('click', () => { void useAccountOnly(); });
  useCloudSessionButton?.addEventListener('click', () => { void resolveConflict('remote'); });
  useDeviceSessionButton?.addEventListener('click', () => { void resolveConflict('local'); });

  const ready = initialize().catch((error) => {
    console.error(error);
    setStatus('Cloud synchronization could not start. Your browser progress remains unchanged.', 'warn');
    document.body.dataset.cloudProgress = 'error';
  });
  window.FreeHTLCloudProgress = Object.freeze({
    ready,
    decisionKey: DECISION_KEY,
    readDecision,
    isConnected,
    reconnectAfterReset,
    resolveConflict
  });
})();
