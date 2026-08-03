import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

function origins() {
  return new Set((Deno.env.get('FHL_ALLOWED_ORIGINS') || '').split(',').map((v) => v.trim()).filter((v) => v && v !== '*'));
}
function headers(origin?: string) {
  const value = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'private, no-store',
    'Vary': 'Origin, Authorization',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin) value.set('Access-Control-Allow-Origin', origin);
  return value;
}
function json(origin: string | undefined, status: number, body: Record<string, unknown>) {
  const responseHeaders = headers(origin);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin') || '';
  if (!origin || !origins().has(origin)) return json(undefined, 403, { error: 'This request origin is not allowed.', requestId });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return json(origin, 405, { error: 'Method not allowed.', requestId });

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json(origin, 401, { error: 'A verified account session is required.', requestId });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const returnUrl = Deno.env.get('FHL_BILLING_RETURN_URL');
  const configurationId = Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID')?.trim() || undefined;
  if (!projectUrl || !publishableKey || !serviceRoleKey || !stripeSecretKey || !returnUrl) {
    return json(origin, 503, { error: 'Billing management is temporarily unavailable.', requestId });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(origin, 401, { error: 'The account session is invalid or expired.', requestId });

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: customer, error: customerError } = await admin
    .from('billing_customers')
    .select('provider_customer_id')
    .eq('user_id', userData.user.id)
    .eq('provider', 'stripe')
    .maybeSingle();
  if (customerError) return json(origin, 503, { error: 'Billing management is temporarily unavailable.', requestId });
  if (!customer?.provider_customer_id) return json(origin, 409, { error: 'No Stripe billing account exists for this learner.', code: 'billing_account_missing', requestId });

  const stripe = new Stripe(stripeSecretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.provider_customer_id,
    return_url: returnUrl,
    configuration: configurationId,
  });
  return json(origin, 200, { portalUrl: session.url, requestId });
});
