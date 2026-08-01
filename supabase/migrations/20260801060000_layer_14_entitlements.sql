begin;

create table public.entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  status text not null default 'free',
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  grace_until timestamptz,
  canceled_at timestamptz,
  revoked_at timestamptz,
  source text not null default 'manual',
  source_reference text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (user_id, product_code),
  constraint entitlements_product_code_not_blank check (btrim(product_code) <> ''),
  constraint entitlements_status_allowed check (
    status in (
      'free',
      'trial',
      'premium',
      'grace',
      'canceled',
      'expired',
      'revoked',
      'administrative',
      'institutional'
    )
  ),
  constraint entitlements_source_not_blank check (btrim(source) <> ''),
  constraint entitlements_valid_window check (
    valid_until is null or valid_until >= valid_from
  ),
  constraint entitlements_grace_window check (
    grace_until is null or grace_until >= coalesce(valid_until, valid_from)
  ),
  constraint entitlements_grace_requires_end check (
    status <> 'grace' or grace_until is not null
  ),
  constraint entitlements_canceled_requires_timestamp check (
    status <> 'canceled' or canceled_at is not null
  ),
  constraint entitlements_expired_requires_end check (
    status <> 'expired' or valid_until is not null
  ),
  constraint entitlements_revocation_consistent check (
    (status = 'revoked' and revoked_at is not null)
    or
    (status <> 'revoked' and revoked_at is null)
  )
);

create table public.entitlement_events (
  event_id uuid primary key default extensions.gen_random_uuid(),
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  event_type text not null,
  previous_status text,
  new_status text not null,
  source text not null,
  source_reference text,
  actor_type text not null default 'server',
  occurred_at timestamptz not null default statement_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  constraint entitlement_events_product_code_not_blank check (btrim(product_code) <> ''),
  constraint entitlement_events_type_allowed check (
    event_type in ('created', 'updated', 'status_changed')
  ),
  constraint entitlement_events_new_status_allowed check (
    new_status in (
      'free',
      'trial',
      'premium',
      'grace',
      'canceled',
      'expired',
      'revoked',
      'administrative',
      'institutional'
    )
  ),
  constraint entitlement_events_previous_status_allowed check (
    previous_status is null or previous_status in (
      'free',
      'trial',
      'premium',
      'grace',
      'canceled',
      'expired',
      'revoked',
      'administrative',
      'institutional'
    )
  ),
  constraint entitlement_events_source_not_blank check (btrim(source) <> ''),
  constraint entitlement_events_actor_not_blank check (btrim(actor_type) <> '')
);

create index entitlements_user_status_idx
  on public.entitlements (user_id, status);

create index entitlements_product_status_idx
  on public.entitlements (product_code, status);

create index entitlement_events_user_occurred_idx
  on public.entitlement_events (user_id, occurred_at desc);

create index entitlement_events_entitlement_occurred_idx
  on public.entitlement_events (entitlement_id, occurred_at desc);

create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

create or replace function public.record_entitlement_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif old.status is distinct from new.status then
    event_name := 'status_changed';
  else
    event_name := 'updated';
  end if;

  insert into public.entitlement_events (
    entitlement_id,
    user_id,
    product_code,
    event_type,
    previous_status,
    new_status,
    source,
    source_reference,
    actor_type
  )
  values (
    new.id,
    new.user_id,
    new.product_code,
    event_name,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.source,
    new.source_reference,
    'server'
  );

  return new;
end;
$$;

create trigger entitlements_record_event
after insert or update on public.entitlements
for each row execute function public.record_entitlement_event();

create or replace function public.has_effective_entitlement(
  requested_user_id uuid,
  requested_product_code text,
  checked_at timestamptz default statement_timestamp()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements as entitlement
    where entitlement.user_id = requested_user_id
      and entitlement.product_code = requested_product_code
      and entitlement.valid_from <= checked_at
      and entitlement.revoked_at is null
      and (
        (
          entitlement.status in ('trial', 'premium', 'administrative', 'institutional')
          and (entitlement.valid_until is null or entitlement.valid_until > checked_at)
        )
        or
        (
          entitlement.status = 'grace'
          and entitlement.grace_until is not null
          and entitlement.grace_until > checked_at
        )
        or
        (
          entitlement.status = 'canceled'
          and coalesce(entitlement.grace_until, entitlement.valid_until) is not null
          and coalesce(entitlement.grace_until, entitlement.valid_until) > checked_at
        )
      )
  );
$$;

alter table public.entitlements enable row level security;
alter table public.entitlement_events enable row level security;

revoke all on table public.entitlements from anon;
revoke all on table public.entitlements from authenticated;
revoke all on table public.entitlement_events from anon;
revoke all on table public.entitlement_events from authenticated;

revoke all on function public.has_effective_entitlement(uuid, text, timestamptz) from public;
revoke all on function public.has_effective_entitlement(uuid, text, timestamptz) from anon;
revoke all on function public.has_effective_entitlement(uuid, text, timestamptz) from authenticated;
grant execute on function public.has_effective_entitlement(uuid, text, timestamptz) to service_role;

grant select, insert, update, delete on table public.entitlements to service_role;
grant select, insert on table public.entitlement_events to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'premium-content',
  'premium-content',
  false,
  10485760,
  array[
    'application/json',
    'application/pdf',
    'application/zip',
    'text/html; charset=utf-8',
    'text/plain; charset=utf-8'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
