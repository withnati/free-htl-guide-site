(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const service = window.FreeHTLProgress;
  let latestModel = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function formatDate(value) {
    if (!value) return 'Not yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  function accessBadge(tier) {
    const label = tier === 'premium' ? 'Premium planned' : tier === 'registered' ? 'Account feature' : 'Public';
    return `<span class="access-badge access-${escapeHtml(tier)}">${label}</span>`;
  }

  function activityText(item) {
    const labels = {
      'module-section-viewed': `Viewed ${item.sectionId || 'a lesson section'} in ${item.page || 'a module'}`,
      'study-task-updated': `${item.checked ? 'Completed' : 'Updated'} study task ${item.taskId || ''}`,
      'quiz-completed': `Completed ${item.page || 'module'} quiz at ${item.percent ?? 0}%`,
      'mock-exam-completed': `Completed a ${item.mode || ''} mock exam at ${item.percent ?? 0}%`,
      'targeted-practice-completed': `Completed a ${item.mode || ''} targeted set at ${item.percent ?? 0}%`,
      'legacy-progress-imported': `Imported ${item.importedRecords || 0} existing browser progress records`,
      'progress-reset': 'Reset learning progress'
    };
    return labels[item.type] || 'Updated learning progress';
  }

  function renderModules(model) {
    const root = $('[data-module-progress]');
    root.innerHTML = model.modules.map((item) => `
      <article class="module-row">
        <div><h3><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></h3><div class="module-meta">${escapeHtml(item.domain)}${item.lastSection ? ` · Last section: ${escapeHtml(item.lastSection)}` : ''}</div></div>
        <div class="module-status"><span class="module-meta">Status</span><div class="status-value">${escapeHtml(item.status)}</div></div>
        <div class="module-score"><span class="module-meta">Best quiz</span><div class="status-value">${item.bestQuiz ? `${item.bestQuiz}%` : '—'}</div></div>
        <div>${accessBadge(item.accessTier)}</div>
      </article>`).join('');
  }

  function renderDomains(model) {
    const root = $('[data-domain-progress]');
    const measured = model.domains.filter((item) => item.average !== null);
    root.innerHTML = measured.length ? measured.map((item) => `
      <div class="domain-row">
        <strong>${escapeHtml(item.domain)}</strong>
        <div class="domain-track" aria-label="${escapeHtml(item.domain)} average ${item.average}%"><i style="width:${Math.max(0, Math.min(100, item.average))}%"></i></div>
        <span>${item.average}%</span>
      </div>`).join('') : '<div class="empty-state">Complete a mock exam or targeted set to generate five-domain performance trends.</div>';
  }

  function renderActivity(model) {
    const root = $('[data-recent-activity]');
    root.innerHTML = model.recentActivity.length ? model.recentActivity.map((item) => `
      <div class="activity-item"><strong>${escapeHtml(activityText(item))}</strong><div class="module-meta">${escapeHtml(formatDate(item.occurredAt))}</div></div>`).join('') : '<div class="empty-state">Your recent study activity will appear here.</div>';
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
      <a class="btn btn-primary" href="${escapeHtml(recommendation.path)}">Continue</a>`;

    $('[data-account-status]').textContent = model.account.localOnly ? 'Anonymous browser profile' : 'Verified learner account';
    $('[data-storage-status]').textContent = model.account.localOnly ? 'This browser only' : 'Supabase cloud';
    $('[data-access-status]').textContent = model.account.entitlement.tier === 'public' ? 'Public preview' : model.account.entitlement.tier;
    $('[data-migration-status]').textContent = model.account.localOnly ? 'Ready for explicit import' : 'Account record active';

    renderModules(model);
    renderDomains(model);
    renderActivity(model);
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
    const cloudConnected = Boolean(window.FreeHTLCloudProgress?.isConnected?.()) || Boolean(latestModel && !latestModel.account.localOnly);
    await service.resetProgress();
    if (cloudConnected) await window.FreeHTLCloudProgress?.reconnectAfterReset?.();
    $('[data-reset-confirmation]').hidden = true;
    await refresh();
    $('[data-progress-status]').textContent = cloudConnected
      ? 'Cloud progress and the temporary browser backup were reset. Account identity and privacy choices were not removed.'
      : 'Progress reset. Notes, theme, and analytics choices were not removed.';
    $('[data-progress-status]').focus();
  });

  service?.subscribe(() => { void refresh(); });
  void refresh();
})();