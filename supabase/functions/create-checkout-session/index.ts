import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { resolveStripePlan, resolveStripePriceId } from '../_shared/stripe-plans.ts';

function configuredOrigins() {
  const configured = Deno.env.get('FHL_ALLOWED_ORIGINS') || '';
  return new Set(
    configured.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== '*')
  );
}

function responseHeaders(origin?: string) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin, Authorization',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function jsonResponse(origin: string | undefined, status: number, body: Record<string, unknown>) {
  const headers = responseHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = configuredOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    return jsonResponse(undefined, 403, { error: 'This request origin is not allowed.', requestId });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(origin, 405, { error: 'Method not allowed.', requestId });
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse(origin, 401, { error: 'A verified account session is required.', requestId });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const successUrl = Deno.env.get('FHL_CHECKOUT_SUCCESS_URL');
  const cancelUrl = Deno.env.get('FHL_CHECKOUT_CANCEL_URL');

  if (!projectUrl || !publishableKey || !serviceRoleKey || !stripeSecretKey || !successUrl || !cancelUrl) {
    console.error(JSON.stringify({ requestId, error: 'checkout_environment_unavailable' }));
    return jsonResponse(origin, 503, { error: 'Checkout is temporarily unavailable.', requestId });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(origin, 401, { error: 'The account session is invalid or expired.', requestId });
  }

  let payload: { plan?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(origin, 400, { error: 'A JSON request body is required.', requestId });
  }

  const plan = resolveStripePlan(payload.plan);
  if (!plan) {
    return jsonResponse(origin, 400, { error: 'Select a valid Premium billing plan.', requestId });
  }

  let priceId: string;
  try {
    priceId = resolveStripePriceId(plan);
  } catch (error) {
    console.error(JSON.stringify({ requestId, error: 'stripe_price_unavailable', plan: plan.code }));
    return jsonResponse(origin, 503, { error: 'Checkout is temporarily unavailable.', requestId });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stripe = new Stripe(stripeSecretKey);

  const { data: existingCustomer, error: customerReadError } = await adminClient
    .from('billing_customers')
    .select('provider_customer_id')
    .eq('user_id', userData.user.id)
    .eq('provider', 'stripe')
    .maybeSingle();

  if (customerReadError) {
    console.error(JSON.stringify({ requestId, error: 'billing_customer_lookup_failed' }));
    return jsonResponse(origin, 503, { error: 'Checkout is temporarily unavailable.', requestId });
  }

  let customerId = existingCustomer?.provider_customer_id || '';
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email || undefined,
      metadata: { fhl_user_id: userData.user.id },
    }, { idempotencyKey: `fhl-customer-${userData.user.id}` });
    customerId = customer.id;

    const { error: customerWriteError } = await adminClient
      .from('billing_customers')
      .upsert({
        user_id: userData.user.id,
        provider: 'stripe',
        provider_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (customerWriteError) {
      console.error(JSON.stringify({ requestId, error: 'billing_customer_persist_failed' }));
      return jsonResponse(origin, 503, { error: 'Checkout is temporarily unavailable.', requestId });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userData.user.id,
    allow_promotion_codes: false,
    subscription_data: {
      metadata: {
        fhl_user_id: userData.user.id,
        fhl_product_code: plan.productCode,
        fhl_plan_code: plan.code,
      },
    },
    metadata: {
      fhl_user_id: userData.user.id,
      fhl_product_code: plan.productCode,
      fhl_plan_code: plan.code,
    },
  });

  if (!session.url) {
    console.error(JSON.stringify({ requestId, error: 'checkout_url_missing' }));
    return jsonResponse(origin, 503, { error: 'Checkout is temporarily unavailable.', requestId });
  }

  return jsonResponse(origin, 200, { checkoutUrl: session.url, requestId });
});
