export type StripePlanCode = 'premium_monthly' | 'premium_annual';

type StripePlan = {
  code: StripePlanCode;
  priceEnvironmentName: string;
  productCode: 'fhl-premium';
};

const PLANS: Record<StripePlanCode, StripePlan> = {
  premium_monthly: {
    code: 'premium_monthly',
    priceEnvironmentName: 'STRIPE_PRICE_PREMIUM_MONTHLY',
    productCode: 'fhl-premium',
  },
  premium_annual: {
    code: 'premium_annual',
    priceEnvironmentName: 'STRIPE_PRICE_PREMIUM_ANNUAL',
    productCode: 'fhl-premium',
  },
};

export function resolveStripePlan(value: unknown): StripePlan | null {
  if (value !== 'premium_monthly' && value !== 'premium_annual') return null;
  return PLANS[value];
}

export function resolveStripePriceId(plan: StripePlan): string {
  const priceId = Deno.env.get(plan.priceEnvironmentName)?.trim() || '';
  if (!priceId.startsWith('price_')) {
    throw new Error(`Missing or invalid ${plan.priceEnvironmentName}.`);
  }
  return priceId;
}
