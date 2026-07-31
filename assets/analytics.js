(() => {
  'use strict';

  const analyticsScript = document.currentScript
    || [...document.scripts].find((script) => /\/analytics\.js(?:\?|$)/.test(script.src));
  if (!analyticsScript?.src) return;

  const assetBase = new URL('.', analyticsScript.src);
  const configUrl = new URL('../data/analytics-config.json', analyticsScript.src);
  const consentStyleUrl = new URL('analytics-consent.css', assetBase);
  const PAGE_ID = document.body?.dataset?.page || window.location.pathname;
  const PROJECT_PATH = '/free-htl-guide-site/';
  const debugEvents = [];
  const startedQuizzes = new Set();
  const scrollMilestones = new Set();

  let config = null;
  let tagLoaded = false;
  let consentStatus = 'unset';

  function loadSharedFeatures() {
    const sharedScripts = [
      ['signup.js', 'data-free-htl-signup'],
      ['authority.js', 'data-free-htl-authority'],
      ['seo.js', 'data-free-htl-seo']
    ];

    sharedScripts.forEach(([filename, marker]) => {
      if (document.querySelector(`script[${marker}]`)) return;
      const script = document.createElement('script');
      script.src = new URL(filename, assetBase).href;
      script.async = true;
      script.setAttribute(marker, 'true');
      document.head.appendChild(script);
    });
  }

  loadSharedFeatures();

  function ensureConsentStyles() {
    if (document.querySelector('link[data-free-htl-analytics-consent]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = consentStyleUrl.href;
    link.dataset.freeHtlAnalyticsConsent = 'true';
    document.head.appendChild(link);
  }

  function cleanText(value, max = 120) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function safeUrl(value, includeOrigin = true) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return includeOrigin ? `${url.origin}${url.pathname}` : url.pathname;
    } catch {
      return '';
    }
  }

  function validMeasurementId(value) {
    return /^G-[A-Z0-9]{6,}$/i.test(String(value || ''));
  }

  function analyticsConfigured() {
    return Boolean(config?.enabled && validMeasurementId(config.measurementId));
  }

  function debugEnabled() {
    const parameter = config?.debugParameter || 'analytics_debug';
    return new URLSearchParams(window.location.search).get(parameter) === '1';
  }

  function loadConsentRecord() {
    if (!config?.storageKey) return 'unset';
    try {
      const parsed = JSON.parse(localStorage.getItem(config.storageKey) || 'null');
      if (!parsed || parsed.version !== config.consentVersion) return 'unset';
      return ['granted', 'denied'].includes(parsed.status) ? parsed.status : 'unset';
    } catch {
      return 'unset';
    }
  }

  function saveConsentRecord(status) {
    if (!config?.storageKey) return;
    localStorage.setItem(config.storageKey, JSON.stringify({
      status,
      version: config.consentVersion,
      updatedAt: new Date().toISOString()
    }));
  }

  function removeAnalyticsCookies() {
    const cookieNames = document.cookie
      .split(';')
      .map((item) => item.split('=')[0].trim())
      .filter((name) => /^_ga(?:_|$)/.test(name));
    const paths = ['/', PROJECT_PATH];
    const securityVariants = ['', '; Secure'];
    const sameSiteVariants = ['; SameSite=Lax', '; SameSite=None; Secure'];

    cookieNames.forEach((name) => {
      paths.forEach((path) => {
        securityVariants.forEach((security) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=${path}${security}`;
        });
        sameSiteVariants.forEach((sameSite) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=${path}${sameSite}`;
        });
      });
    });
  }

  function setConsentDefaults() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
  }

  function updateGoogleConsent(status) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      analytics_storage: status === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function scrubParameters(eventName, parameters = {}) {
    const allowlist = new Set(config?.allowedEvents?.[eventName] || []);
    const prohibited = (config?.prohibitedFields || []).map((field) => field.toLowerCase());
    const cleaned = {
      site_name: 'Free HTL Guide',
      page_id: cleanText(PAGE_ID, 80),
      page_path: safeUrl(window.location.href, false),
      event_schema_version: Number(config?.eventSchemaVersion || 1)
    };

    Object.entries(parameters).forEach(([key, value]) => {
      const lowered = key.toLowerCase();
      if (!allowlist.has(key)) return;
      if (prohibited.some((field) => lowered === field || lowered.startsWith(`${field}_`) || lowered.endsWith(`_${field}`))) return;
      if (value === null || value === undefined) return;

      if (typeof value === 'boolean') {
        cleaned[key] = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        cleaned[key] = value;
      } else if (key.endsWith('_url') || key === 'page_location' || key === 'page_referrer') {
        const sanitizedUrl = safeUrl(value, true);
        if (sanitizedUrl) cleaned[key] = sanitizedUrl.slice(0, 240);
      } else if (key.endsWith('_path')) {
        const sanitizedPath = safeUrl(value, false);
        if (sanitizedPath) cleaned[key] = sanitizedPath.slice(0, 160);
      } else {
        const text = cleanText(value, 160);
        if (text) cleaned[key] = text;
      }
    });

    return cleaned;
  }

  function recordDebugEvent(eventName, payload) {
    if (!debugEnabled()) return;
    const entry = Object.freeze({ eventName, payload: Object.freeze({ ...payload }) });
    debugEvents.push(entry);
    if (debugEvents.length > 100) debugEvents.shift();
    console.info('[Free HTL Analytics]', eventName, payload);
    renderDebugPanel();
  }

  function track(eventName, parameters = {}) {
    if (!config?.allowedEvents?.[eventName]) return false;
    const payload = scrubParameters(eventName, parameters);
    recordDebugEvent(eventName, payload);

    if (!analyticsConfigured() || consentStatus !== 'granted' || !tagLoaded || typeof window.gtag !== 'function') {
      return false;
    }

    window.gtag('event', eventName, payload);
    return true;
  }

  function sendPageView() {
    track('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_referrer: document.referrer
    });
  }

  function loadGoogleTag() {
    if (!analyticsConfigured() || consentStatus !== 'granted' || tagLoaded) return;
    setConsentDefaults();
    updateGoogleConsent('granted');

    window.gtag('js', new Date());
    window.gtag('config', config.measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_update: false,
      transport_type: 'beacon',
      debug_mode: debugEnabled()
    });

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
    tag.setAttribute('data-free-htl-google-tag', 'true');
    tag.addEventListener('load', () => {
      tagLoaded = true;
      document.body.dataset.analyticsActive = 'true';
      sendPageView();
      renderPrivacyState();
    });
    tag.addEventListener('error', () => {
      document.body.dataset.analyticsActive = 'error';
      renderPrivacyState();
    });
    document.head.appendChild(tag);
  }

  function consentLabel() {
    if (!analyticsConfigured()) return 'Analytics is currently off.';
    if (consentStatus === 'granted') return 'Optional analytics is allowed on this device.';
    if (consentStatus === 'denied') return 'Optional analytics is declined on this device.';
    return 'No analytics choice has been saved on this device.';
  }

  function buildPrivacyControls() {
    ensureConsentStyles();
    if (document.querySelector('[data-analytics-dialog]')) return;

    const footer = document.querySelector('.footer-inner') || document.querySelector('footer') || document.body;
    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'privacy-choice-button';
    openButton.dataset.analyticsOpen = 'true';
    openButton.textContent = 'Privacy choices';

    const dialog = document.createElement('dialog');
    dialog.className = 'analytics-dialog';
    dialog.setAttribute('aria-labelledby', 'analytics-dialog-title');
    dialog.dataset.analyticsDialog = 'true';
    dialog.innerHTML = `
      <form method="dialog" class="analytics-dialog-card">
        <div class="analytics-dialog-heading">
          <div>
            <p class="eyebrow">Optional measurement</p>
            <h2 id="analytics-dialog-title">Privacy choices</h2>
          </div>
          <button class="btn analytics-close" value="close" aria-label="Close privacy choices">Close</button>
        </div>
        <p data-analytics-state></p>
        <p class="small muted">When enabled, analytics measures page and feature use. It does not collect email addresses, personal notes, quiz answers, or question-level responses.</p>
        <div class="analytics-choice-actions" data-analytics-actions>
          <button type="button" class="btn btn-primary" data-analytics-consent="granted">Allow analytics</button>
          <button type="button" class="btn" data-analytics-consent="denied">Decline analytics</button>
        </div>
        <p class="small"><a data-analytics-privacy-link href="privacy.html">Read the privacy policy</a></p>
      </form>`;

    footer.appendChild(openButton);
    document.body.appendChild(dialog);

    openButton.addEventListener('click', () => {
      renderPrivacyState();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });

    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-analytics-consent]');
      if (!button) return;
      setConsent(button.dataset.analyticsConsent);
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });

    if (config?.privacyUrl) {
      const privacyLink = dialog.querySelector('[data-analytics-privacy-link]');
      privacyLink.href = new URL(config.privacyUrl, window.location.href).href;
    }

    if (analyticsConfigured() && consentStatus === 'unset') {
      const banner = document.createElement('section');
      banner.className = 'analytics-banner';
      banner.dataset.analyticsBanner = 'true';
      banner.setAttribute('aria-label', 'Optional analytics choice');
      banner.innerHTML = `
        <div>
          <strong>Help improve this free study guide?</strong>
          <p>Optional analytics can measure page and feature use. No email addresses, personal notes, or quiz answers are collected.</p>
        </div>
        <div class="analytics-banner-actions">
          <button type="button" class="btn btn-primary" data-analytics-consent="granted">Allow analytics</button>
          <button type="button" class="btn" data-analytics-consent="denied">Decline analytics</button>
          <button type="button" class="btn" data-analytics-open-banner>Details</button>
        </div>`;
      document.body.appendChild(banner);

      banner.addEventListener('click', (event) => {
        const consentButton = event.target.closest('[data-analytics-consent]');
        if (consentButton) {
          setConsent(consentButton.dataset.analyticsConsent);
          return;
        }
        if (event.target.closest('[data-analytics-open-banner]')) {
          if (typeof dialog.showModal === 'function') dialog.showModal();
          else dialog.setAttribute('open', '');
        }
      });
    }

    renderPrivacyState();
  }

  function renderPrivacyState() {
    const state = document.querySelector('[data-analytics-state]');
    if (state) state.textContent = consentLabel();
    const actions = document.querySelector('[data-analytics-actions]');
    if (actions) actions.hidden = !analyticsConfigured();
    const banner = document.querySelector('[data-analytics-banner]');
    if (banner && consentStatus !== 'unset') banner.remove();
    document.body.dataset.analyticsConfigured = String(analyticsConfigured());
    document.body.dataset.analyticsConsent = consentStatus;
  }

  function renderDebugPanel() {
    if (!debugEnabled()) return;
    let panel = document.querySelector('[data-analytics-debug]');
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'analytics-debug';
      panel.dataset.analyticsDebug = 'true';
      document.body.appendChild(panel);
    }
    const latest = debugEvents.at(-1);
    panel.textContent = latest
      ? `Analytics debug · ${consentStatus} · ${latest.eventName} · ${JSON.stringify(latest.payload)}`
      : `Analytics debug · ${consentStatus} · no events yet`;
  }

  function setConsent(status) {
    if (!['granted', 'denied'].includes(status)) return false;
    const previousStatus = consentStatus;
    consentStatus = status;
    saveConsentRecord(status);

    if (status === 'granted') {
      if (tagLoaded) {
        updateGoogleConsent('granted');
        document.body.dataset.analyticsActive = 'true';
        if (previousStatus !== 'granted') sendPageView();
      } else {
        loadGoogleTag();
      }
    } else {
      setConsentDefaults();
      updateGoogleConsent('denied');
      removeAnalyticsCookies();
      document.body.dataset.analyticsActive = 'false';
    }

    renderPrivacyState();
    renderDebugPanel();
    window.dispatchEvent(new CustomEvent('htl:analytics-consent', { detail: { status } }));
    return true;
  }

  function scoreBand(percent) {
    const value = Number(percent || 0);
    if (value >= 80) return '80-100';
    if (value >= 60) return '60-79';
    if (value >= 40) return '40-59';
    return '0-39';
  }

  function bindMeasurementEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const link = target?.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      let absoluteUrl;
      try {
        absoluteUrl = new URL(href, window.location.href);
      } catch {
        return;
      }
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
      } else if (/\/modules\//.test(absoluteUrl.pathname)) {
        track('module_open', {
          module_path: absoluteUrl.href,
          link_text: label
        });
      } else if (absoluteUrl.origin !== window.location.origin) {
        track('outbound_click', {
          link_domain: absoluteUrl.hostname,
          link_text: label,
          link_url: absoluteUrl.href
        });
      }
    });

    document.addEventListener('change', (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      const form = input?.closest('form');
      if (!input || !form || !input.closest('fieldset[data-correct]') || startedQuizzes.has(form)) return;
      startedQuizzes.add(form);
      track('quiz_start', { quiz_id: form.id || PAGE_ID });
    });

    const handleScroll = () => {
      const root = document.documentElement;
      const maximum = root.scrollHeight - root.clientHeight;
      if (maximum <= 0) return;
      const percent = Math.round((root.scrollTop / maximum) * 100);
      [25, 50, 75, 100].forEach((milestone) => {
        if (percent >= milestone && !scrollMilestones.has(milestone)) {
          scrollMilestones.add(milestone);
          track('scroll_depth', { scroll_percent: milestone });
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    window.addEventListener('htl:email-signup-start', (event) => {
      const detail = event.detail || {};
      track('email_signup_start', {
        form_id: detail.formId,
        signup_source: detail.source
      });
    });

    window.addEventListener('htl:email-signup-success', (event) => {
      const detail = event.detail || {};
      track('email_signup_success', {
        form_id: detail.formId,
        signup_source: detail.source,
        transport_type: 'beacon'
      });
    });

    window.addEventListener('htl:email-signup-error', (event) => {
      const detail = event.detail || {};
      track('email_signup_error', {
        form_id: detail.formId,
        signup_source: detail.source,
        error_type: detail.errorType
      });
    });

    window.addEventListener('htl:quiz-graded', (event) => {
      const detail = event.detail || {};
      track('quiz_complete', {
        quiz_id: detail.quizId || detail.page || PAGE_ID,
        score: Number(detail.score || 0),
        total_questions: Number(detail.total || 0),
        score_percent: Number(detail.percent || 0),
        score_band: scoreBand(detail.percent),
        target_met: Boolean(detail.targetMet)
      });
    });

    window.addEventListener('htl:quiz-reset', (event) => {
      const detail = event.detail || {};
      track('quiz_reset', { quiz_id: detail.quizId || detail.page || PAGE_ID });
    });

    window.addEventListener('htl:study-task', (event) => {
      const detail = event.detail || {};
      track('study_task_toggle', {
        task_id: detail.taskId,
        checked: Boolean(detail.checked)
      });
    });

    window.addEventListener('htl:share', (event) => {
      const detail = event.detail || {};
      track('share', {
        share_method: detail.method,
        share_page: detail.page,
        share_url: detail.url
      });
    });
  }

  const api = {
    get enabled() { return analyticsConfigured() && consentStatus === 'granted' && tagLoaded; },
    get configured() { return analyticsConfigured(); },
    get consent() { return consentStatus; },
    get measurementId() { return analyticsConfigured() ? config.measurementId : null; },
    get debugEvents() { return [...debugEvents]; },
    track,
    setConsent,
    openPreferences() {
      const dialog = document.querySelector('[data-analytics-dialog]');
      if (!dialog) return false;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      return true;
    }
  };
  window.FreeHTLAnalytics = Object.freeze(api);

  bindMeasurementEvents();

  fetch(configUrl, { credentials: 'same-origin', cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Analytics configuration returned ${response.status}`);
      return response.json();
    })
    .then((loadedConfig) => {
      config = loadedConfig;
      consentStatus = config.consentRequired ? loadConsentRecord() : 'granted';
      setConsentDefaults();
      buildPrivacyControls();
      renderDebugPanel();
      if (debugEnabled() && !analyticsConfigured()) sendPageView();
      if (analyticsConfigured() && consentStatus === 'granted') loadGoogleTag();
    })
    .catch((error) => {
      document.body.dataset.analyticsConfigured = 'false';
      if (new URLSearchParams(window.location.search).get('analytics_debug') === '1') {
        console.warn('[Free HTL Analytics] Configuration unavailable', error);
      }
    });
})();
