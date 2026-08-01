(() => {
  'use strict';

  const monthly = document.querySelector('[data-billing-monthly]');
  const annual = document.querySelector('[data-billing-annual]');
  const amount = document.querySelector('[data-premium-amount]');
  const cadence = document.querySelector('[data-premium-cadence]');
  const savings = document.querySelector('[data-annual-savings]');
  const upgradeButtons = document.querySelectorAll('[data-upgrade-plan]');
  const notice = document.querySelector('[data-enrollment-notice]');

  function selectCadence(value) {
    if (!monthly || !annual) return;
    const isAnnual = value === 'annual';
    monthly.setAttribute('aria-pressed', String(!isAnnual));
    annual.setAttribute('aria-pressed', String(isAnnual));
    if (amount) amount.textContent = isAnnual ? '$191.99' : '$19.99';
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
    button.addEventListener('click', () => {
      if (!notice) return;
      notice.hidden = false;
      notice.focus();
    });
  });

  document.querySelectorAll('[data-subscription-state]').forEach((control) => {
    control.addEventListener('click', () => {
      const state = control.dataset.subscriptionState;
      document.querySelectorAll('.state-panel').forEach((panel) => {
        panel.dataset.active = String(panel.dataset.state === state);
      });
    });
  });

  selectCadence('monthly');
})();
