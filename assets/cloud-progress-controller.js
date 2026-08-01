(() => {
  'use strict';

  const service = window.FreeHTLProgress;
  const auth = window.FreeHTLAuth;
  const cloud = window.FreeHTLCloudProgressAdapter;
  const $ = (selector) => document.querySelector(selector);
  const status = $('[data-progress-status]');
  const importPanel = $('[data-cloud-import]');
  const importSummary = $('[data-cloud-import-summary]');
  const importButton = $('[data-import-progress]');
  const accountOnlyButton = $('[data-account-progress-only]');
  const anonymousActions = $('[data-anonymous-account-actions]');
  const authenticatedActions = $('[data-authenticated-account-actions]');
  const accountEmail = $('[data-cloud-account-email]');
  let adapter = null;
  let browserRecord = null;

  function setStatus(message, tone = 'info', focus = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.classList.toggle('warn', tone === 'warn');
    if (focus) status.focus();
  }

  function setBusy(busy) {
    [importButton, accountOnlyButton].filter(Boolean).forEach((button) => {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
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

  async function connectAccountProgress(options = {}) {
    await service.useAdapter(adapter);
    if (importPanel) importPanel.hidden = true;
    setStatus(options.reset
      ? 'Cloud progress was reset. The temporary browser backup was also removed.'
      : 'Cloud sync is connected to this verified account. Your browser copy remains available as a recovery backup.', 'info', true);
    document.body.dataset.cloudProgress = 'connected';
  }

  async function reconnectAfterReset() {
    if (!adapter) return;
    localStorage.removeItem(service.storageKey());
    await connectAccountProgress({ reset: true });
  }

  async function importBrowserProgress() {
    setBusy(true);
    setStatus('Importing and reconciling your browser progress…');
    try {
      await adapter.importRecord(browserRecord);
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
      await connectAccountProgress();
    } catch (error) {
      console.error(error);
      setStatus('Account progress could not be loaded. Your browser progress remains unchanged.', 'warn', true);
      document.body.dataset.cloudProgress = 'error';
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    if (!service || !auth || !cloud) {
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
      if (anonymousActions) anonymousActions.hidden = false;
      if (authenticatedActions) authenticatedActions.hidden = true;
      setStatus('Progress is stored in this browser. Sign in or create an account to enable cloud synchronization.');
      document.body.dataset.cloudProgress = 'anonymous';
      return;
    }

    if (anonymousActions) anonymousActions.hidden = true;
    if (authenticatedActions) authenticatedActions.hidden = false;
    if (accountEmail) accountEmail.textContent = session.user.email || 'Verified learner';
    browserRecord = await service.getSnapshot();
    adapter = new cloud.CloudProgressAdapter(auth.client, session.user.id, { schemaVersion: browserRecord.schemaVersion });

    const [remoteRecord, alreadyImported] = await Promise.all([
      adapter.load(),
      adapter.hasCompletedMigration(browserRecord.recordId)
    ]);
    const browserHasProgress = browserRecord.owner?.kind === 'anonymous' && cloud.hasMeaningfulProgress(browserRecord);
    const remoteHasProgress = cloud.hasMeaningfulProgress(remoteRecord);

    if (browserHasProgress && !alreadyImported) {
      if (importSummary) importSummary.textContent = `${countSummary(cloud.progressCounts(browserRecord))} were found on this browser.${remoteHasProgress ? ' They can be merged with the progress already saved to your account.' : ''}`;
      if (importPanel) importPanel.hidden = false;
      setStatus('You are signed in. Choose whether to import this browser’s progress before cloud sync begins.', 'warn');
      document.body.dataset.cloudProgress = 'awaiting-import';
      return;
    }

    await connectAccountProgress();
  }

  importButton?.addEventListener('click', () => { void importBrowserProgress(); });
  accountOnlyButton?.addEventListener('click', () => { void useAccountOnly(); });

  const ready = initialize().catch((error) => {
    console.error(error);
    setStatus('Cloud synchronization could not start. Your browser progress remains unchanged.', 'warn');
    document.body.dataset.cloudProgress = 'error';
  });
  window.FreeHTLCloudProgress = Object.freeze({
    ready,
    reconnectAfterReset,
    isConnected: () => Boolean(adapter && document.body.dataset.cloudProgress === 'connected')
  });
})();