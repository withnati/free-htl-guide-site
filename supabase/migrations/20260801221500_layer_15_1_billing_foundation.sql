-- Layer 15.1 provider-neutral billing foundation.
-- All writes are server-only. Browser clients receive no direct table privileges.

create type public.billing_subscription_state as enum (
  'trialing','active','grace','past_due','canceled','unpaid','expired','refunded','disputed','revoked'
);

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id),
  unique (user_id, provider)
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  billing_customer_id uuid not null references public.billing_customers(id) on delete cascade,
  provider text not null,
  provider_subscription_id text not null,
  provider_product_id text,
  provider_price_id text,
  normalized_state public.billing_subscription_state not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  provider_event_created_at timestamptz,
  provider_object_version bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_event_type text not null,
  provider_created_at timestamptz not null,
  signature_verified boolean not null default false,
  processing_status text not null check (processing_status in ('received','processed','ignored_stale','failed')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  last_error_code text,
  payload_digest text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.billing_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grants_premium boolean not null,
  reason text not null check (length(trim(reason)) >= 10),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

create table public.billing_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  billing_event_id uuid references public.billing_events(id) on delete set null,
  action text not null,
  previous_state public.billing_subscription_state,
  resulting_state public.billing_subscription_state,
  grants_premium boolean,
  effective_until timestamptz,
  reason text not null,
  actor_type text not null check (actor_type in ('webhook','reconciliation','administrator','system')),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index billing_subscriptions_user_idx on public.billing_subscriptions(user_id);
create index billing_subscriptions_state_idx on public.billing_subscriptions(normalized_state);
create index billing_events_status_idx on public.billing_events(processing_status, received_at);
create index billing_audit_user_idx on public.billing_audit_log(user_id, created_at desc);
create index billing_overrides_user_idx on public.billing_overrides(user_id, starts_at desc);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_overrides enable row level security;
alter table public.billing_audit_log enable row level security;

revoke all on public.billing_customers from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
revoke all on public.billing_events from anon, authenticated;
revoke all on public.billing_overrides from anon, authenticated;
revoke all on public.billing_audit_log from anon, authenticated;

comment on table public.billing_events is 'Immutable idempotency ledger; raw payment payloads are not stored.';
comment on table public.billing_overrides is 'Time-bounded, reason-required administrative corrections; provider history is never rewritten.';
