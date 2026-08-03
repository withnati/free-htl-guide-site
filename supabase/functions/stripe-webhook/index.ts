import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import {
  normalizeStripeSubscriptionStatus,
  paymentGraceUntil,
  subscriptionPeriod,
  unixToIso,
} from '../_shared/stripe-subscriptions.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const stripe = new Stripe(stripeSecretKey);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function entitlementProjection(state: string, periodEnd: string | null, graceUntil: string | null) {
  if (state === 'trialing') return { status: 'trial', validUntil: periodEnd, graceUntil: null };
  if (state === 'active') return { status: 'premium', validUntil: periodEnd, graceUntil: null };
  if (state === 'past_due' && graceUntil) return { status: 'grace', validUntil: periodEnd, graceUntil };
  if (state === 'canceled' && periodEnd && new Date(periodEnd).getTime() > Date.now()) {
    return { status: 'canceled', validUntil: periodEnd, graceUntil: null };
  }
  if (state === 'refunded' || state === 'disputed' || state === 'revoked') {
    return { status: 'revoked', validUntil: periodEnd, graceUntil: null };
  }
  return { status: 'expired', validUntil: periodEnd, graceUntil: null };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!stripeSecretKey || !webhookSecret) return json(503, { error: 'Webhook configuration unavailable.' });

  const signature = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch {
    return json(400, { error: 'Invalid webhook signature.' });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceRoleKey) return json(503, { error: 'Webhook storage unavailable.' });

  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
  const payloadDigest = [...new Uint8Array(digestBytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

  const { data: ledgerRow, error: ledgerError } = await admin
    .from('billing_events')
    .insert({
      provider: 'stripe',
      provider_event_id: event.id,
      provider_event_type: event.type,
      provider_created_at: new Date(event.created * 1000).toISOString(),
      signature_verified: true,
      processing_status: 'received',
      processing_attempts: 1,
      payload_digest: payloadDigest,
    })
    .select('id')
    .single();

  if (ledgerError) {
    if (ledgerError.code === '23505') return json(200, { received: true, duplicate: true });
    console.error(JSON.stringify({ error: 'billing_event_insert_failed', eventId: event.id }));
    return json(500, { error: 'Webhook processing failed.' });
  }

  const markEvent = async (processingStatus: 'processed' | 'ignored_stale' | 'failed', lastErrorCode?: string) => {
    await admin.from('billing_events').update({
      processing_status: processingStatus,
      processed_at: new Date().toISOString(),
      last_error_code: lastErrorCode || null,
    }).eq('id', ledgerRow.id);
  };

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.fhl_user_id || '';
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';
      if (userId && customerId) {
        await admin.from('billing_customers').upsert({
          user_id: userId,
          provider: 'stripe',
          provider_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });
      }
      await markEvent('processed');
      return json(200, { received: true });
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
      let userId = subscription.metadata?.fhl_user_id || '';

      if (!userId) {
        const { data: customer } = await admin
          .from('billing_customers')
          .select('user_id')
          .eq('provider', 'stripe')
          .eq('provider_customer_id', customerId)
          .maybeSingle();
        userId = customer?.user_id || '';
      }

      if (!userId) throw new Error('billing_user_unresolved');

      const { data: existing } = await admin
        .from('billing_subscriptions')
        .select('id,provider_event_created_at')
        .eq('provider', 'stripe')
        .eq('provider_subscription_id', subscription.id)
        .maybeSingle();

      const incomingCreatedAt = new Date(event.created * 1000).toISOString();
      if (existing?.provider_event_created_at && existing.provider_event_created_at > incomingCreatedAt) {
        await markEvent('ignored_stale');
        return json(200, { received: true, stale: true });
      }

      const state = normalizeStripeSubscriptionStatus(subscription.status);
      const period = subscriptionPeriod(subscription);
      const periodStart = unixToIso(period.currentPeriodStart);
      const periodEnd = unixToIso(period.currentPeriodEnd);
      const graceUntil = state === 'past_due' ? paymentGraceUntil(event.created) : null;
      const firstItem = subscription.items?.data?.[0];
      const priceId = firstItem?.price?.id || null;
      const productId = typeof firstItem?.price?.product === 'string'
        ? firstItem.price.product
        : firstItem?.price?.product?.id || null;

      const { data: billingCustomer, error: billingCustomerError } = await admin
        .from('billing_customers')
        .upsert({
          user_id: userId,
          provider: 'stripe',
          provider_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' })
        .select('id')
        .single();
      if (billingCustomerError || !billingCustomer) throw new Error('billing_customer_upsert_failed');

      const { data: billingSubscription, error: subscriptionError } = await admin
        .from('billing_subscriptions')
        .upsert({
          user_id: userId,
          billing_customer_id: billingCustomer.id,
          provider: 'stripe',
          provider_subscription_id: subscription.id,
          provider_product_id: productId,
          provider_price_id: priceId,
          normalized_state: state,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          grace_until: graceUntil,
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: unixToIso(subscription.canceled_at),
          provider_event_created_at: incomingCreatedAt,
          metadata: {
            fhl_plan_code: subscription.metadata?.fhl_plan_code || null,
            fhl_product_code: subscription.metadata?.fhl_product_code || 'fhl-premium',
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'provider,provider_subscription_id' })
        .select('id')
        .single();
      if (subscriptionError || !billingSubscription) throw new Error('billing_subscription_upsert_failed');

      const projection = entitlementProjection(state, periodEnd, graceUntil);
      const now = new Date().toISOString();
      const { error: entitlementError } = await admin.from('entitlements').upsert({
        user_id: userId,
        product_code: 'fhl-premium',
        status: projection.status,
        valid_from: periodStart || now,
        valid_until: projection.validUntil,
        grace_until: projection.graceUntil,
        canceled_at: state === 'canceled' ? unixToIso(subscription.canceled_at) || now : null,
        revoked_at: projection.status === 'revoked' ? now : null,
        source: 'stripe',
        source_reference: subscription.id,
        updated_at: now,
      }, { onConflict: 'user_id,product_code' });
      if (entitlementError) throw new Error('entitlement_projection_failed');

      await admin.from('billing_audit_log').insert({
        user_id: userId,
        subscription_id: billingSubscription.id,
        billing_event_id: ledgerRow.id,
        action: 'stripe_subscription_projected',
        resulting_state: state,
        grants_premium: ['trialing', 'active'].includes(state) || (state === 'past_due' && Boolean(graceUntil)),
        effective_until: graceUntil || periodEnd,
        reason: `Stripe event ${event.type} projected to entitlement state ${projection.status}.`,
        actor_type: 'webhook',
      });

      await markEvent('processed');
      return json(200, { received: true });
    }

    await markEvent('processed');
    return json(200, { received: true, ignored: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unhandled_webhook_error';
    console.error(JSON.stringify({ error: code, eventId: event.id, eventType: event.type }));
    await markEvent('failed', code);
    return json(500, { error: 'Webhook processing failed.' });
  }
});
