(() => {
  'use strict';

  // Add the production GA4 Measurement ID here after the privacy policy and
  // Google Analytics property are ready. Example format: G-XXXXXXXXXX.
  const MEASUREMENT_ID = '';
  const DEBUG = new URLSearchParams(window.location.search).get('analytics_debug') === '1';
  const ENABLED = /^G-[A-Z0-9]+$/i.test(MEASUREMENT_ID);
  const PAGE_ID = document.body?.dataset?.page || window.location.pathname;

  const cleanText = (value, max = 120) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  const track = (eventName, parameters = {}) => {
    const payload = {
      site_name: 'Free HTL Guide',
      page_id: PAGE_ID,
      page_path: window.location.pathname,
      ...parameters
    };

    if (DEBUG) {
      console.info('[Free HTL Analytics]', eventName, payload);
    }

    if (ENABLED && typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }
  };

  window.FreeHTLAnalytics = Object.freeze({
    enabled: ENABLED,
    measurementId: ENABLED ? MEASUREMENT_ID : null,
    track
  });

  if (ENABLED) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: true
    });

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(tag);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = target?.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const absoluteUrl = new URL(href, window.location.href);
    if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return;

    const label = cleanText(link.textContent || link.getAttribute('aria-label') || absoluteUrl.pathname);
    const extension = absoluteUrl.pathname.split('.').pop()?.toLowerCase();

    if (['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      track('file_download', {
        file_name: absoluteUrl.pathname.split('/').pop(),
        file_extension: extension,
        link_text: label,
        link_url: absoluteUrl.href
      });
      return;
    }

    if (/\/modules\//.test(absoluteUrl.pathname)) {
      track('module_open', {
        module_path: absoluteUrl.pathname,
        link_text: label
      });
      return;
    }

    if (absoluteUrl.origin !== window.location.origin) {
      track('outbound_click', {
        link_domain: absoluteUrl.hostname,
        link_text: label,
        link_url: absoluteUrl.href
      });
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.querySelector('input[type="email"]')) {
      track('email_signup_submit', {
        form_action: form.action || window.location.href
      });
    }
  });

  window.addEventListener('htl:quiz-graded', (event) => {
    const detail = event.detail || {};
    track('quiz_complete', {
      quiz_id: cleanText(detail.quizId || detail.page || PAGE_ID),
      score: Number(detail.score || 0),
      total_questions: Number(detail.total || 0),
      score_percent: Number(detail.percent || 0),
      target_met: Boolean(detail.targetMet)
    });
  });

  window.addEventListener('htl:quiz-reset', (event) => {
    const detail = event.detail || {};
    track('quiz_reset', {
      quiz_id: cleanText(detail.quizId || detail.page || PAGE_ID)
    });
  });

  window.addEventListener('htl:study-task', (event) => {
    const detail = event.detail || {};
    track('study_task_toggle', {
      task_id: cleanText(detail.taskId),
      checked: Boolean(detail.checked)
    });
  });
})();
