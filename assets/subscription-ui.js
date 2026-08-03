(() => {
  'use strict';

  const monthly = document.querySelector('[data-billing-monthly]');
  const annual = document.querySelector('[data-billing-annual]');
  const amount = document.querySelector('[data-premium-amount]');
  const cadence = document.querySelector('[data-premium-cadence]');
  const savings = document.querySelector('[data-annual-savings]');
  const upgradeButtons = document.querySelectorAll('[data-upgrade-plan]');
  const notice = document.querySelector('[data-enrollment-notice]');
  const billing = window.FreeHTLBilling;

  function showNotice(message, state = 'info') {
    if (!notice) return;
    notice.textContent = message;
    notice.dataset.state = state;
    notice.hidden = false;
    notice.focus({ preventScroll: true });
  }

  function signInUrl() {
    const target = window.FreeHTLAuth?.siteUrl('account/sign-in.html');
    return `${target}?next=${encodeURIComponent(window.location.href)}`;
  }

  function selectCadence(value) {
    if (!monthly || !annual) return;
    const isAnnual = value === 'annual';
    monthly.setAttribute('aria-pressed', String(!isAnnual));
    annual.setAttribute('aria-pressed', String(isAnnual));
    if (amount) amount.textContent = isAnnual ? '$99.99' : '$9.99';
    if (cadence) cadence.textContent = isAnnual ? 'per year' : 'per month';
    if (savings) savings.hidden = !isAnnual;
    upgradeButtons.forEach((button) => {
      button.dataset.upgradePlan = isAnnual ? 'premium_annual' : 'premium_monthly';
      button.textContent = isAnnual ? 'Choose annual Premium' : 'Choose monthly Premium';
    });
  }

  monthly?.addEventListener('click', () => selectCadence('monthly'));
  annual?.addEventListener('click', () => selectCadence('annual'));

  upgradeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      if (!billing) return showNotice('Checkout is temporarily unavailable. Please try again later.', 'error');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      showNotice('Opening secure Stripe checkout…');
      try {
        const result = await billing.createCheckout(button.dataset.upgradePlan);
        if (result.requiresSignIn) {
          window.location.assign(signInUrl());
          return;
        }
        if (result.data?.manageSubscription === true) {
          showNotice('You already have a subscription. Opening your billing settings…');
          window.location.assign(window.FreeHTLAuth.siteUrl('account/subscription.html'));
          return;
        }
        const checkoutUrl = billing.approvedCheckoutUrl(result.data?.checkoutUrl);
        if (result.error || !checkoutUrl) throw result.error || new Error('Checkout URL unavailable.');
        window.location.assign(checkoutUrl);
      } catch {
        showNotice('We could not open checkout. Please try again in a moment.', 'error');
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  });

  function displayState(state) {
    document.querySelectorAll('.state-panel').forEach((panel) => {
      panel.dataset.active = String(panel.dataset.state === state);
    });
  }

  function formatDate(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  }

  async function loadSubscription() {
    const status = document.querySelector('[data-billing-status]');
    if (!status || !billing) return;
    try {
      const result = await billing.getSubscriptionStatus();
      if (result.requiresSignIn) {
        window.location.replace(signInUrl());
        return;
      }
      if (result.error || !result.data) throw result.error || new Error('Status unavailable.');
      const value = result.data;
      let state = 'expired';
      if (value.state === 'free') state = 'free';
      else if (value.cancelAtPeriodEnd || value.state === 'canceled') state = 'canceling';
      else if (value.state === 'trialing' || value.state === 'active') state = 'active';
      else if (value.state === 'past_due' || value.state === 'grace') state = 'grace';
      displayState(state);
      document.querySelectorAll('[data-billing-cadence]').forEach((node) => {
        node.textContent = value.billingCadence === 'annual' ? 'Annual' : value.billingCadence === 'monthly' ? 'Monthly' : 'Not available';
      });
      document.querySelectorAll('[data-current-period-end]').forEach((node) => { node.textContent = formatDate(value.currentPeriodEnd); });
      document.querySelectorAll('[data-grace-until]').forEach((node) => { node.textContent = value.graceUntil ? `Update by ${formatDate(value.graceUntil)}.` : ''; });
      document.querySelectorAll('[data-manage-billing]').forEach((button) => { button.hidden = !value.canManageBilling; });
      status.hidden = true;
    } catch {
      status.textContent = 'We could not load your subscription. Please refresh the page or try again later.';
      status.dataset.state = 'error';
    }
  }

  document.querySelectorAll('[data-manage-billing]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const status = document.querySelector('[data-billing-status]');
      if (status) { status.textContent = 'Opening secure billing management…'; status.hidden = false; }
      try {
        const result = await billing.createPortal();
        const portalUrl = billing.approvedPortalUrl(result.data?.portalUrl);
        if (result.requiresSignIn) return window.location.replace(signInUrl());
        if (result.error || !portalUrl) throw result.error || new Error('Portal URL unavailable.');
        window.location.assign(portalUrl);
      } catch {
        if (status) { status.textContent = 'We could not open billing management. Please try again later.'; status.dataset.state = 'error'; }
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  });

  selectCadence('monthly');
  loadSubscription();
})();
