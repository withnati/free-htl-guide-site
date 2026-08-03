import type Stripe from 'npm:stripe@^22';

export type NormalizedBillingState =
  | 'trialing'
  | 'active'
  | 'grace'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'expired'
  | 'refunded'
  | 'disputed'
  | 'revoked';

export function normalizeStripeSubscriptionStatus(status: Stripe.Subscription.Status): NormalizedBillingState {
  switch (status) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'canceled': return 'canceled';
    case 'unpaid': return 'unpaid';
    case 'incomplete': return 'unpaid';
    case 'incomplete_expired': return 'expired';
    case 'paused': return 'revoked';
    default: return 'revoked';
  }
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const items = subscription.items?.data || [];
  const starts = items.map((item) => item.current_period_start).filter((value): value is number => Number.isFinite(value));
  const ends = items.map((item) => item.current_period_end).filter((value): value is number => Number.isFinite(value));
  return {
    currentPeriodStart: starts.length ? Math.min(...starts) : null,
    currentPeriodEnd: ends.length ? Math.max(...ends) : null,
  };
}

export function unixToIso(value: number | null | undefined): string | null {
  return Number.isFinite(value) ? new Date(Number(value) * 1000).toISOString() : null;
}

export function paymentGraceUntil(eventCreated: number): string | null {
  const rawDays = Deno.env.get('FHL_PAYMENT_GRACE_DAYS')?.trim() || '0';
  const days = Number.parseInt(rawDays, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date((eventCreated + days * 86400) * 1000).toISOString();
}
