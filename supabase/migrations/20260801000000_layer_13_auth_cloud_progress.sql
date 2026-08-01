begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 80)
);

create table public.module_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  started_at timestamptz,
  last_activity_at timestamptz,
  last_section_id text,
  sections_viewed text[] not null default array[]::text[],
  completed_at timestamptz,
  revision bigint not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, module_id),
  constraint module_progress_module_id_not_blank check (btrim(module_id) <> ''),
  constraint module_progress_revision_positive check (revision > 0)
);

create table public.study_task_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  task_id text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  revision bigint not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, page_id, task_id),
  constraint study_task_page_id_not_blank check (btrim(page_id) <> ''),
  constraint study_task_task_id_not_blank check (btrim(task_id) <> ''),
  constraint study_task_completion_consistent
    check ((completed and completed_at is not null) or (not completed and completed_at is null)),
  constraint study_task_revision_positive check (revision > 0)
);

create table public.learning_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id text not null,
  attempt_type text not null,
  activity_id text,
  module_id text,
  mode text,
  source_mode text,
  selected_domains text[] not null default array[]::text[],
  selected_difficulties text[] not null default array[]::text[],
  requested_count integer,
  started_at timestamptz,
  completed_at timestamptz not null,
  correct_count integer not null,
  question_count integer not null,
  percent numeric(5,2) not null,
  duration_ms bigint,
  time_expired boolean not null default false,
  legacy boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, attempt_id),
  constraint learning_attempt_id_not_blank check (btrim(attempt_id) <> ''),
  constraint learning_attempt_type_allowed
    check (attempt_type in ('module_quiz', 'mock_exam', 'targeted_practice')),
  constraint learning_attempt_counts_valid
    check (question_count >= 0 and correct_count >= 0 and correct_count <= question_count),
  constraint learning_attempt_percent_valid check (percent between 0 and 100),
  constraint learning_attempt_requested_count_valid
    check (requested_count is null or requested_count between 1 and 100),
  constraint learning_attempt_duration_valid check (duration_ms is null or duration_ms >= 0)
);

create table public.attempt_domain_results (
  user_id uuid not null,
  attempt_id text not null,
  domain_id text not null,
  correct_count integer not null,
  question_count integer not null,
  percent numeric(5,2) not null,
  primary key (user_id, attempt_id, domain_id),
  foreign key (user_id, attempt_id)
    references public.learning_attempts(user_id, attempt_id) on delete cascade,
  constraint attempt_domain_id_not_blank check (btrim(domain_id) <> ''),
  constraint attempt_domain_counts_valid
    check (question_count >= 0 and correct_count >= 0 and correct_count <= question_count),
  constraint attempt_domain_percent_valid check (percent between 0 and 100)
);

create table public.attempt_question_results (
  user_id uuid not null,
  attempt_id text not null,
  question_id text not null,
  source_question_id text not null,
  module_id text,
  domain_id text,
  difficulty text,
  selected_option_id text,
  is_correct boolean not null,
  was_flagged boolean not null default false,
  primary key (user_id, attempt_id, question_id),
  foreign key (user_id, attempt_id)
    references public.learning_attempts(user_id, attempt_id) on delete cascade,
  constraint attempt_question_id_not_blank check (btrim(question_id) <> ''),
  constraint attempt_source_question_id_not_blank check (btrim(source_question_id) <> ''),
  constraint attempt_question_difficulty_allowed
    check (difficulty is null or difficulty in ('Foundational', 'Application', 'Troubleshooting'))
);

create table public.active_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_type text not null,
  session_id text not null,
  activity_id text not null,
  mode text not null,
  source_mode text,
  selected_domains text[] not null default array[]::text[],
  selected_difficulties text[] not null default array[]::text[],
  requested_count integer,
  current_index integer not null default 0,
  question_ids text[] not null default array[]::text[],
  started_at timestamptz not null,
  expires_at timestamptz,
  client_updated_at timestamptz,
  server_updated_at timestamptz not null default statement_timestamp(),
  revision bigint not null default 1,
  primary key (user_id, session_type),
  constraint active_session_type_allowed
    check (session_type in ('mock-exam', 'targeted-practice')),
  constraint active_session_id_not_blank check (btrim(session_id) <> ''),
  constraint active_session_activity_id_not_blank check (btrim(activity_id) <> ''),
  constraint active_session_mode_not_blank check (btrim(mode) <> ''),
  constraint active_session_current_index_valid check (current_index >= 0),
  constraint active_session_requested_count_valid
    check (requested_count is null or requested_count between 1 and 100),
  constraint active_session_revision_positive check (revision > 0)
);

create table public.active_session_responses (
  user_id uuid not null,
  session_type text not null,
  question_id text not null,
  selected_option_id text,
  is_flagged boolean not null default false,
  feedback_checked boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, session_type, question_id),
  foreign key (user_id, session_type)
    references public.active_sessions(user_id, session_type) on delete cascade,
  constraint active_session_response_question_id_not_blank check (btrim(question_id) <> '')
);

create table public.learning_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null,
  activity_type text not null,
  occurred_at timestamptz not null,
  module_id text,
  task_id text,
  related_attempt_id text,
  mode text,
  percent numeric(5,2),
  imported_record_count integer,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, activity_id),
  constraint learning_activity_id_not_blank check (btrim(activity_id) <> ''),
  constraint learning_activity_type_not_blank check (btrim(activity_type) <> ''),
  constraint learning_activity_percent_valid check (percent is null or percent between 0 and 100),
  constraint learning_activity_import_count_valid
    check (imported_record_count is null or imported_record_count >= 0)
);

create table public.progress_migrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  migration_id uuid not null default extensions.gen_random_uuid(),
  anonymous_record_id text not null,
  source_schema_version integer not null,
  status text not null default 'started',
  module_count integer not null default 0,
  study_task_count integer not null default 0,
  quiz_attempt_count integer not null default 0,
  mock_attempt_count integer not null default 0,
  targeted_attempt_count integer not null default 0,
  active_session_count integer not null default 0,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, migration_id),
  unique (user_id, anonymous_record_id),
  constraint progress_migration_anonymous_record_not_blank check (btrim(anonymous_record_id) <> ''),
  constraint progress_migration_schema_version_valid check (source_schema_version > 0),
  constraint progress_migration_status_allowed
    check (status in ('started', 'completed', 'failed')),
  constraint progress_migration_counts_valid check (
    module_count >= 0 and
    study_task_count >= 0 and
    quiz_attempt_count >= 0 and
    mock_attempt_count >= 0 and
    targeted_attempt_count >= 0 and
    active_session_count >= 0
  ),
  constraint progress_migration_completion_consistent check (
    (status = 'completed' and completed_at is not null) or
    (status <> 'completed' and completed_at is null)
  )
);

create index module_progress_user_activity_idx
  on public.module_progress (user_id, last_activity_at desc nulls last);
create index study_task_progress_user_updated_idx
  on public.study_task_progress (user_id, updated_at desc);
create index learning_attempts_user_completed_idx
  on public.learning_attempts (user_id, completed_at desc);
create index learning_attempts_user_type_completed_idx
  on public.learning_attempts (user_id, attempt_type, completed_at desc);
create index attempt_domain_results_user_domain_idx
  on public.attempt_domain_results (user_id, domain_id);
create index attempt_question_results_user_question_idx
  on public.attempt_question_results (user_id, question_id);
create index attempt_question_results_user_source_idx
  on public.attempt_question_results (user_id, source_question_id);
create index attempt_question_results_flagged_idx
  on public.attempt_question_results (user_id, was_flagged)
  where was_flagged;
create index active_sessions_user_updated_idx
  on public.active_sessions (user_id, server_updated_at desc);
create index learning_activity_user_occurred_idx
  on public.learning_activity (user_id, occurred_at desc);
create index progress_migrations_user_updated_idx
  on public.progress_migrations (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function public.bump_revision_and_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function public.bump_active_session_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.server_updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function public.touch_active_response()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger module_progress_bump_revision
before update on public.module_progress
for each row execute function public.bump_revision_and_updated_at();

create trigger study_task_progress_bump_revision
before update on public.study_task_progress
for each row execute function public.bump_revision_and_updated_at();

create trigger active_sessions_bump_revision
before update on public.active_sessions
for each row execute function public.bump_active_session_revision();

create trigger active_session_responses_touch
before update on public.active_session_responses
for each row execute function public.touch_active_response();

create trigger progress_migrations_set_updated_at
before update on public.progress_migrations
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (user_id, display_name)
select
  users.id,
  nullif(left(btrim(coalesce(users.raw_user_meta_data ->> 'display_name', '')), 80), '')
from auth.users as users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.module_progress enable row level security;
alter table public.study_task_progress enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.attempt_domain_results enable row level security;
alter table public.attempt_question_results enable row level security;
alter table public.active_sessions enable row level security;
alter table public.active_session_responses enable row level security;
alter table public.learning_activity enable row level security;
alter table public.progress_migrations enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy module_progress_manage_own
on public.module_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy study_task_progress_manage_own
on public.study_task_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy learning_attempts_select_own
on public.learning_attempts for select to authenticated
using ((select auth.uid()) = user_id);

create policy learning_attempts_insert_own
on public.learning_attempts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy learning_attempts_delete_own
on public.learning_attempts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy attempt_domain_results_select_own
on public.attempt_domain_results for select to authenticated
using ((select auth.uid()) = user_id);

create policy attempt_domain_results_insert_own
on public.attempt_domain_results for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy attempt_domain_results_delete_own
on public.attempt_domain_results for delete to authenticated
using ((select auth.uid()) = user_id);

create policy attempt_question_results_select_own
on public.attempt_question_results for select to authenticated
using ((select auth.uid()) = user_id);

create policy attempt_question_results_insert_own
on public.attempt_question_results for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy attempt_question_results_delete_own
on public.attempt_question_results for delete to authenticated
using ((select auth.uid()) = user_id);

create policy active_sessions_manage_own
on public.active_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy active_session_responses_manage_own
on public.active_session_responses for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy learning_activity_select_own
on public.learning_activity for select to authenticated
using ((select auth.uid()) = user_id);

create policy learning_activity_insert_own
on public.learning_activity for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy learning_activity_delete_own
on public.learning_activity for delete to authenticated
using ((select auth.uid()) = user_id);

create policy progress_migrations_manage_own
on public.progress_migrations for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.module_progress from anon;
revoke all on table public.study_task_progress from anon;
revoke all on table public.learning_attempts from anon;
revoke all on table public.attempt_domain_results from anon;
revoke all on table public.attempt_question_results from anon;
revoke all on table public.active_sessions from anon;
revoke all on table public.active_session_responses from anon;
revoke all on table public.learning_activity from anon;
revoke all on table public.progress_migrations from anon;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.module_progress to authenticated;
grant select, insert, update, delete on table public.study_task_progress to authenticated;
grant select, insert, delete on table public.learning_attempts to authenticated;
grant select, insert, delete on table public.attempt_domain_results to authenticated;
grant select, insert, delete on table public.attempt_question_results to authenticated;
grant select, insert, update, delete on table public.active_sessions to authenticated;
grant select, insert, update, delete on table public.active_session_responses to authenticated;
grant select, insert, delete on table public.learning_activity to authenticated;
grant select, insert, update, delete on table public.progress_migrations to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

comment on table public.learning_attempts is
  'Completed quiz, mock-exam, and targeted-practice attempts. Question content and answer keys are intentionally excluded.';
comment on table public.attempt_question_results is
  'Stable IDs and learner outcomes only; never store question text, explanations, or answer keys.';
comment on table public.active_session_responses is
  'Selected-option IDs and session state only; unrestricted answer-content JSON is intentionally avoided.';

commit;
