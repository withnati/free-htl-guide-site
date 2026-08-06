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
  const TOKEN_CLOCK_RETRY_DELAYS = [1000, 2000];
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
    const value = { userId, mode, decidedAt: new Date().toISOString() };
    if (mode === 'imported' && browserRecord?.updatedAt) value.lastLocalSyncAt = browserRecord.updatedAt;
    localStorage.setItem(DECISION_KEY, JSON.stringify(value));
  }

  function countSummary(counts) {
    const parts = [
      [counts.modules, 'lesson record'],
      [counts.studyTasks, 'study task'],
      [counts.quizAttempts, 'quiz attempt'],
      [counts.mockAttempts, 'mock-exam attempt'],
      [counts.targetedAttempts, 'Targeted Practice attempt'],
      [counts.activeSessions, 'unfinished session']
    ].filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}${count === 1 ? '' : 's'}`);
    return parts.length ? parts.join(', ') : 'study progress';
  }

  function syncMessage(syncStatus) {
    const values = {
      saving: ['Saving your progress…', 'info'],
      saved: ['Your progress is saved to your account.', 'info'],
      offline: ['You are offline. Your changes are saved on this device and will be added to your account when the connection returns.', 'warn'],
      error: ['We could not save the latest changes to your account yet. They remain saved on this device and will be retried.', 'warn'],
      conflict: ['A newer unfinished session is saved to your account. Choose which session to continue. Completed work will remain available.', 'warn']
    };
    return values[syncStatus] || null;
  }

  function isTokenClockSkew(error) {
    return /jwt issued at future/i.test(String(error?.message || ''));
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function loadInitialAccountState() {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await Promise.all([
          adapter.load(),
          adapter.hasCompletedMigration(browserRecord.recordId)
        ]);
      } catch (error) {
        const delay = TOKEN_CLOCK_RETRY_DELAYS[attempt];
        if (!isTokenClockSkew(error) || delay === undefined) throw error;
        setStatus('Finishing the secure account connection…');
        await wait(delay);
      }
    }
  }

  function showConflict(conflict = null) {
    if (!conflictPanel) return;
    const type = conflict?.sessionType === 'targeted-practice' ? 'Targeted Practice' : 'mock exam';
    const updated = conflict?.serverUpdatedAt ? new Date(conflict.serverUpdatedAt) : null;
    const timeText = updated && !Number.isNaN(updated.getTime())
      ? ` The account session was updated ${updated.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`
      : '';
    conflictSummary.textContent = `A newer unfinished ${type} is saved to your account.${timeText}`;
    conflictPanel.hidden = false;
    document.body.dataset.cloudProgress = 'conflict';
  }

  function hideConflict() {
    if (conflictPanel) conflictPanel.hidden = true;
  }

  async function connectAccountProgress(message = 'Your study progress is connected to this account. A copy remains on this device to help recover from connection problems.') {
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
    setStatus('Adding this device’s study progress to your account…');
    try {
      await adapter.importRecord(browserRecord);
      saveDecision('imported');
      await connectAccountProgress();
    } catch (error) {
      console.error(error);
      setStatus('We could not add this device’s progress to your account. Nothing was deleted. Please try again.', 'warn', true);
      document.body.dataset.cloudProgress = 'error';
    } finally {
      setBusy(false);
    }
  }

  async function useAccountOnly() {
    setBusy(true);
    setStatus('Loading the progress already saved to your account…');
    try {
      saveDecision('account-only');
      await connectAccountProgress('Your account progress is ready. Earlier study activity on this device remains separate and unchanged.');
    } catch (error) {
      console.error(error);
      localStorage.removeItem(DECISION_KEY);
      setStatus('We could not load the progress saved to your account. Study activity on this device remains unchanged.', 'warn', true);
      document.body.dataset.cloudProgress = 'error';
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(strategy) {
    if (!adapter?.resolveConflict) return;
    setBusy(true);
    setStatus(strategy === 'remote'
      ? 'Opening the newer session from your account…'
      : 'Using the unfinished session saved on this device…');
    try {
      await adapter.resolveConflict(strategy);
      await service.useAdapter(adapter);
      hideConflict();
      lastSyncStatus = 'saved';
      document.body.dataset.cloudProgress = 'connected';
      setStatus(strategy === 'remote'
        ? 'The newer account session is ready to continue. Your other progress was preserved.'
        : 'This device’s session is ready to continue. Your other progress was preserved.', 'info', true);
    } catch (error) {
      console.error(error);
      showConflict(adapter.conflictInfo?.());
      setStatus('We could not complete that choice. Both sessions remain available, and your work on this device is still saved.', 'warn', true);
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    if (!service || !auth || !cloud || !resilience) {
      setStatus('Account progress is temporarily unavailable. Your study activity remains saved on this device.', 'warn');
      document.body.dataset.cloudProgress = 'unavailable';
      return;
    }

    await service.ready;
    let session;
    try {
      session = await auth.ready;
    } catch (error) {
      console.error(error);
      setStatus('We could not reach your account. Your study activity remains saved on this device.', 'warn');
      document.body.dataset.cloudProgress = 'unavailable';
      return;
    }

    if (!session?.user?.id) {
      anonymousActions.hidden = false;
      authenticatedActions.hidden = true;
      setStatus('Progress on this device is available here. Sign in or create a free account to continue across devices.');
      document.body.dataset.cloudProgress = 'anonymous';
      return;
    }

    userId = session.user.id;
    anonymousActions.hidden = true;
    authenticatedActions.hidden = false;
    if (accountEmail) accountEmail.textContent = session.user.email || 'Learner';
    browserRecord = await service.getSnapshot();
    const baseAdapter = new cloud.CloudProgressAdapter(auth.client, userId, { schemaVersion: browserRecord.schemaVersion });
    adapter = new resilience.ResilientCloudAdapter(baseAdapter);

    const decision = readDecision(userId);
    if (decision) {
      const message = decision.mode === 'imported'
        ? 'Your study progress is connected to this account. A recovery copy remains on this device.'
        : 'Your account progress is connected. Earlier study activity on this device remains separate.';
      await connectAccountProgress(message);
      return;
    }

    const [remoteRecord, alreadyImported] = await loadInitialAccountState();
    const browserHasProgress = browserRecord.owner?.kind === 'anonymous' && cloud.hasMeaningfulProgress(browserRecord);
    const remoteHasProgress = cloud.hasMeaningfulProgress(remoteRecord);

    if (alreadyImported) {
      saveDecision('imported');
      await connectAccountProgress();
      return;
    }

    if (browserHasProgress) {
      importSummary.textContent = `${countSummary(cloud.progressCounts(browserRecord))} ${remoteHasProgress ? 'can be added to the progress already saved to your account.' : 'can be added to your account.'}`;
      importPanel.hidden = false;
      setStatus('We found study activity saved on this device. Choose how you would like to continue.', 'warn');
      document.body.dataset.cloudProgress = 'awaiting-import';
      return;
    }

    saveDecision('account-only');
    await connectAccountProgress('Your account progress is ready. No earlier study activity was found on this device.');
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
    setStatus('We could not start account progress. Your study activity remains saved on this device.', 'warn');
    document.body.dataset.cloudProgress = 'error';
  });
  window.FreeHTLCloudProgress = Object.freeze({ ready, decisionKey: DECISION_KEY, readDecision, isConnected, reconnectAfterReset, resolveConflict });
})();
