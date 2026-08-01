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
  const DECISION_KEY = 'free-htl-cloud-sync-v1';
  let adapter = null;
  let browserRecord = null;
  let userId = null;

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
    localStorage.setItem(DECISION_KEY, JSON.stringify({
      userId,
      mode,
      decidedAt: new Date().toISOString()
    }));
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

  async function connectAccountProgress(message = 'Cloud sync is connected to this verified account. Your browser copy remains available as a recovery backup.') {
    await service.useAdapter(adapter);
    importPanel.hidden = true;
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
    adapter = new cloud.CloudProgressAdapter(auth.client, userId, { schemaVersion: browserRecord.schemaVersion });

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

  importButton?.addEventListener('click', () => { void importBrowserProgress(); });
  accountOnlyButton?.addEventListener('click', () => { void useAccountOnly(); });

  const ready = initialize().catch((error) => {
    console.error(error);
    setStatus('Cloud synchronization could not start. Your browser progress remains unchanged.', 'warn');
    document.body.dataset.cloudProgress = 'error';
  });
  window.FreeHTLCloudProgress = Object.freeze({ ready, decisionKey: DECISION_KEY, readDecision });
})();