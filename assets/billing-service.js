(() => {
  'use strict';

  const auth = window.FreeHTLAuth;

  async function session() {
    if (!auth?.client) throw new Error('Billing is temporarily unavailable.');
    await auth.ready;
    const { data, error } = await auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function invoke(name, options) {
    const activeSession = await session();
    if (!activeSession) return { data: null, error: null, requiresSignIn: true };
    const result = await auth.client.functions.invoke(name, options);
    return { ...result, requiresSignIn: false };
  }

  function approvedStripeUrl(value, kind) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return '';
      if (kind === 'checkout' && url.hostname !== 'checkout.stripe.com') return '';
      if (kind === 'portal' && url.hostname !== 'billing.stripe.com') return '';
      return url.href;
    } catch {
      return '';
    }
  }

  async function createCheckout(plan) {
    if (plan !== 'premium_monthly' && plan !== 'premium_annual') {
      throw new Error('Select a valid Premium plan.');
    }
    return invoke('create-checkout-session', { body: { plan } });
  }

  const getSubscriptionStatus = () => invoke('subscription-status', { method: 'GET' });
  const createPortal = () => invoke('create-billing-portal-session', { body: {} });

  window.FreeHTLBilling = Object.freeze({
    createCheckout,
    getSubscriptionStatus,
    createPortal,
    approvedCheckoutUrl: (value) => approvedStripeUrl(value, 'checkout'),
    approvedPortalUrl: (value) => approvedStripeUrl(value, 'portal')
  });
})();
