begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, auth, storage;

select plan(20);

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '33333333-3333-4333-8333-333333333333',
  'entitlement-learner@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Entitlement Learner"}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.entitlements'::regclass),
  'entitlements has Row Level Security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.entitlement_events'::regclass),
  'entitlement_events has Row Level Security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.entitlements', 'SELECT'),
  'anon cannot read entitlement records'
);

select ok(
  not has_table_privilege('authenticated', 'public.entitlements', 'SELECT'),
  'authenticated learners cannot read entitlement records directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.entitlements', 'INSERT'),
  'authenticated learners cannot grant themselves entitlements'
);

select ok(
  not has_table_privilege('authenticated', 'public.entitlement_events', 'SELECT'),
  'authenticated learners cannot read entitlement audit events directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.has_effective_entitlement(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'authenticated learners cannot call the server entitlement function directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.has_effective_entitlement(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'service role can execute the entitlement decision function'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'premium-content'
      and public is false
  ),
  'premium-content storage bucket exists and is private'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  source,
  source_reference
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-premium',
  'free',
  'test',
  'free-baseline'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-premium'
  ),
  false,
  'free status does not grant premium access'
);

select is(
  (
    select count(*)
    from public.entitlement_events
    where user_id = '33333333-3333-4333-8333-333333333333'
      and product_code = 'fhl-premium'
      and event_type = 'created'
  ),
  1::bigint,
  'creating an entitlement records an audit event'
);

update public.entitlements
set
  status = 'premium',
  valid_until = statement_timestamp() + interval '1 day',
  source_reference = 'premium-grant'
where user_id = '33333333-3333-4333-8333-333333333333'
  and product_code = 'fhl-premium';

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-premium'
  ),
  true,
  'active premium status grants access'
);

select is(
  (
    select count(*)
    from public.entitlement_events
    where user_id = '33333333-3333-4333-8333-333333333333'
      and product_code = 'fhl-premium'
      and event_type = 'status_changed'
      and previous_status = 'free'
      and new_status = 'premium'
  ),
  1::bigint,
  'status changes are recorded in the entitlement audit history'
);

update public.entitlements
set
  status = 'revoked',
  revoked_at = statement_timestamp(),
  source_reference = 'revocation-test'
where user_id = '33333333-3333-4333-8333-333333333333'
  and product_code = 'fhl-premium';

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-premium'
  ),
  false,
  'revocation removes premium access'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  valid_until,
  canceled_at,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-canceled-paid-through',
  'canceled',
  statement_timestamp() + interval '1 day',
  statement_timestamp(),
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-canceled-paid-through'
  ),
  true,
  'canceled status retains access through the paid-through time'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  valid_until,
  grace_until,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-grace',
  'grace',
  statement_timestamp() + interval '1 hour',
  statement_timestamp() + interval '1 day',
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-grace'
  ),
  true,
  'active grace period grants temporary access'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  valid_from,
  valid_until,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-expired',
  'expired',
  statement_timestamp() - interval '2 days',
  statement_timestamp() - interval '1 day',
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-expired'
  ),
  false,
  'expired status does not grant access'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  valid_from,
  valid_until,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-expired-trial',
  'trial',
  statement_timestamp() - interval '2 days',
  statement_timestamp() - interval '1 day',
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-expired-trial'
  ),
  false,
  'trial access stops after valid_until'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-administrative',
  'administrative',
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-administrative'
  ),
  true,
  'administrative access is supported'
);

insert into public.entitlements (
  user_id,
  product_code,
  status,
  source
)
values (
  '33333333-3333-4333-8333-333333333333',
  'fhl-institutional',
  'institutional',
  'test'
);

select is(
  public.has_effective_entitlement(
    '33333333-3333-4333-8333-333333333333',
    'fhl-institutional'
  ),
  true,
  'future institutional access is supported'
);

select * from finish();
rollback;
