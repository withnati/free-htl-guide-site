import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

function origins() {
  return new Set((Deno.env.get('FHL_ALLOWED_ORIGINS') || '').split(',').map((v) => v.trim()).filter((v) => v && v !== '*'));
}
function responseHeaders(origin?: string) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin, Authorization',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
function response(origin: string | undefined, status: number, body: Record<string, unknown>) {
  const headers = responseHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin') || '';
  if (!origin || !origins().has(origin)) return response(undefined, 403, { error: 'This request origin is not allowed.', requestId });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (request.method !== 'GET') return response(origin, 405, { error: 'Method not allowed.', requestId });

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return response(origin, 401, { error: 'A verified account session is required.', requestId });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !publishableKey || !serviceRoleKey) return response(origin, 503, { error: 'Subscription status is temporarily unavailable.', requestId });

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response(origin, 401, { error: 'The account session is invalid or expired.', requestId });

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: subscription, error: subscriptionError } = await admin
    .from('billing_subscriptions')
    .select('normalized_state,current_period_end,grace_until,cancel_at_period_end,provider_price_id,updated_at')
    .eq('user_id', userData.user.id)
    .eq('provider', 'stripe')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionError) return response(origin, 503, { error: 'Subscription status is temporarily unavailable.', requestId });

  const { data: entitled, error: entitlementError } = await admin.rpc('has_effective_entitlement', {
    requested_user_id: userData.user.id,
    requested_product_code: 'fhl-premium',
  });
  if (entitlementError) return response(origin, 503, { error: 'Subscription status is temporarily unavailable.', requestId });

  if (!subscription) {
    return response(origin, 200, {
      state: 'free',
      premiumAccess: entitled === true,
      billingCadence: null,
      currentPeriodEnd: null,
      graceUntil: null,
      cancelAtPeriodEnd: false,
      canManageBilling: false,
      requestId,
    });
  }

  const monthlyPrice = Deno.env.get('STRIPE_PRICE_PREMIUM_MONTHLY') || '';
  const annualPrice = Deno.env.get('STRIPE_PRICE_PREMIUM_ANNUAL') || '';
  const cadence = subscription.provider_price_id === monthlyPrice
    ? 'monthly'
    : subscription.provider_price_id === annualPrice
      ? 'annual'
      : 'unknown';

  return response(origin, 200, {
    state: subscription.normalized_state,
    premiumAccess: entitled === true,
    billingCadence: cadence,
    currentPeriodEnd: subscription.current_period_end,
    graceUntil: subscription.grace_until,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canManageBilling: true,
    requestId,
  });
});
