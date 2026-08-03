(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const service = window.FreeHTLProgress;
  let latestModel = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function formatDate(value) {
    if (!value) return 'Not yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  function accessBadge(tier) {
    const label = tier === 'premium' ? 'Premium' : tier === 'registered' ? 'Free account' : 'Free';
    return `<span class="access-badge access-${escapeHtml(tier)}">${label}</span>`;
  }

  function activityText(item) {
    const labels = {
      'module-section-viewed': `Studied ${item.sectionId || 'a lesson section'} in ${item.page || 'a lesson'}`,
      'study-task-updated': `${item.checked ? 'Completed' : 'Updated'} a study task`,
      'quiz-completed': `Completed the ${item.page || 'lesson'} quiz at ${item.percent ?? 0}%`,
      'mock-exam-completed': `Completed a ${item.mode || ''} mock exam at ${item.percent ?? 0}%`,
      'targeted-practice-completed': `Completed a ${item.mode || ''} Targeted Practice set at ${item.percent ?? 0}%`,
      'legacy-progress-imported': `Added ${item.importedRecords || 0} earlier study records`,
      'progress-reset': 'Reset study progress'
    };
    return labels[item.type] || 'Updated study progress';
  }

  function renderModules(model) {
    const root = $('[data-module-progress]');
    root.innerHTML = model.modules.map((item) => `
      <article class="module-row">
        <div><h3><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></h3><div class="module-meta">${escapeHtml(item.domain)}${item.lastSection ? ` · Continue at ${escapeHtml(item.lastSection)}` : ''}</div></div>
        <div class="module-status"><span class="module-meta">Progress</span><div class="status-value">${escapeHtml(item.status)}</div></div>
        <div class="module-score"><span class="module-meta">Best quiz</span><div class="status-value">${item.bestQuiz ? `${item.bestQuiz}%` : '—'}</div></div>
        <div>${accessBadge(item.accessTier)}</div>
      </article>`).join('');
  }

  function renderDomains(model) {
    const root = $('[data-domain-progress]');
    const measured = model.domains.filter((item) => item.average !== null);
    root.innerHTML = measured.length ? measured.map((item) => `
      <div class="domain-row"><strong>${escapeHtml(item.domain)}</strong><div class="domain-track" aria-label="${escapeHtml(item.domain)} average ${item.average}%"><i style="width:${Math.max(0, Math.min(100, item.average))}%"></i></div><span>${item.average}%</span></div>`).join('')
      : '<div class="empty-state">Complete a mock exam or Targeted Practice set to see performance by exam domain.</div>';
  }

  function renderActivity(model) {
    const root = $('[data-recent-activity]');
    root.innerHTML = model.recentActivity.length ? model.recentActivity.map((item) => `
      <div class="activity-item"><strong>${escapeHtml(activityText(item))}</strong><div class="module-meta">${escapeHtml(formatDate(item.occurredAt))}</div></div>`).join('')
      : '<div class="empty-state">Your recent lessons, quizzes, and practice attempts will appear here.</div>';
  }

  function applyTrustedPremiumState(state) {
    const premium = state === 'premium' || state === 'attention';
    if (!premium) return;
    $('[data-dashboard-account-heading]').textContent = state === 'attention'
      ? 'Premium access needs attention'
      : 'Premium learning account';
    $('[data-dashboard-account-copy]').textContent = state === 'attention'
      ? 'Your Premium tools remain available. Review billing soon to avoid an interruption.'
      : 'Your account includes Premium lessons and study tools. Open the Premium library to continue.';
    $('[data-account-status]').textContent = 'Premium learner account';
    $('[data-access-status]').textContent = 'Premium content';
    $('[data-dashboard-access-note]').textContent = 'Premium access is confirmed from trusted account records. Each protected lesson and practice experience checks access again when opened.';
    document.querySelectorAll('[data-premium-dashboard-continue]').forEach((link) => {
      link.href = 'premium/index.html';
      link.textContent = 'Open Premium library';
      link.hidden = false;
    });
  }

  function render(model) {
    latestModel = model;
    $('[data-summary-modules]').textContent = `${model.summary.modulesStarted}/${model.summary.totalModules}`;
    $('[data-summary-quiz]').textContent = model.summary.averageQuiz === null ? '—' : `${model.summary.averageQuiz}%`;
    $('[data-summary-mock]').textContent = model.summary.latestMock ? `${model.summary.latestMock.percent}%` : '—';
    $('[data-summary-tasks]').textContent = String(model.summary.completedTasks);
    $('[data-study-coverage]').textContent = model.summary.coverage;
    $('[data-progress-updated]').textContent = formatDate(model.updatedAt);

    const recommendation = model.recommendation;
    $('[data-next-step]').innerHTML = `
      <div><p class="eyebrow">Recommended next step</p><h2>${escapeHtml(recommendation.title)}</h2><p>${escapeHtml(recommendation.message)}</p>${accessBadge(recommendation.accessTier)}</div>
      <a class="btn btn-primary" href="${escapeHtml(recommendation.path)}">Continue studying</a>`;

    $('[data-account-status]').textContent = model.account.localOnly ? 'Using this device' : 'Free learner account';
    $('[data-storage-status]').textContent = model.account.localOnly ? 'On this device' : 'In your account';
    $('[data-access-status]').textContent = 'Free content';
    $('[data-migration-status]').textContent = model.account.localOnly ? 'Ready to add to an account' : 'Connected to this account';

    renderModules(model);
    renderDomains(model);
    renderActivity(model);
    applyTrustedPremiumState(document.body.dataset.premiumUiState);
    document.body.dataset.progressDashboardLoaded = 'true';
  }

  async function refresh() {
    try {
      await service.ready;
      render(await service.getDashboard());
    } catch (error) {
      console.error(error);
      $('[data-dashboard-error]').hidden = false;
      $('[data-dashboard-content]').hidden = true;
      document.body.dataset.progressDashboardLoaded = 'error';
    }
  }

  $('[data-export-progress]')?.addEventListener('click', async () => {
    const content = await service.exportProgress();
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `free-htl-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('[data-reset-progress]')?.addEventListener('click', () => {
    $('[data-reset-confirmation]').hidden = false;
    $('[data-confirm-reset]')?.focus();
  });

  $('[data-cancel-reset]')?.addEventListener('click', () => {
    $('[data-reset-confirmation]').hidden = true;
    $('[data-reset-progress]')?.focus();
  });

  $('[data-confirm-reset]')?.addEventListener('click', async () => {
    const accountConnected = Boolean(window.FreeHTLCloudProgress?.isConnected?.()) || Boolean(latestModel && !latestModel.account.localOnly);
    await service.resetProgress();
    if (accountConnected) await window.FreeHTLCloudProgress?.reconnectAfterReset?.();
    $('[data-reset-confirmation]').hidden = true;
    await refresh();
    $('[data-progress-status]').textContent = accountConnected
      ? 'Your saved study progress was reset. Your account and privacy choices were not removed.'
      : 'Your study progress on this device was reset. Your notes, theme, and privacy choices were not removed.';
    $('[data-progress-status]').focus();
  });

  service?.subscribe(() => { void refresh(); });
  window.addEventListener('fhl:premium-ui-ready', (event) => applyTrustedPremiumState(event.detail?.state));
  void refresh();
})();
