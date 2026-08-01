begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, auth;

select plan(14);

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'learner-a@example.test',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Learner A"}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'learner-b@example.test',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Learner B"}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

select is(
  (select count(*) from public.profiles where user_id in (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  )),
  2::bigint,
  'Auth-user trigger creates one profile per learner'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.module_progress'::regclass),
  'module_progress has Row Level Security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.learning_attempts'::regclass),
  'learning_attempts has Row Level Security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.active_sessions'::regclass),
  'active_sessions has Row Level Security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.module_progress', 'SELECT'),
  'anon role has no module-progress read privilege'
);

select ok(
  not has_table_privilege('anon', 'public.learning_attempts', 'INSERT'),
  'anon role has no learning-attempt write privilege'
);

insert into public.module_progress (
  user_id,
  module_id,
  started_at,
  last_activity_at,
  last_section_id,
  sections_viewed
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'fixation-v3',
    statement_timestamp(),
    statement_timestamp(),
    'overview',
    array['overview']
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'processing-v3',
    statement_timestamp(),
    statement_timestamp(),
    'overview',
    array['overview']
  );

insert into public.learning_attempts (
  user_id,
  attempt_id,
  attempt_type,
  activity_id,
  mode,
  completed_at,
  correct_count,
  question_count,
  percent
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'attempt-learner-a',
    'targeted_practice',
    'free-htl-targeted-practice',
    'study',
    statement_timestamp(),
    8,
    10,
    80
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'attempt-learner-b',
    'mock_exam',
    'free-htl-mock-50',
    'untimed',
    statement_timestamp(),
    35,
    50,
    70
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'Learner A sees only their own profile'
);

select is(
  (select count(*) from public.module_progress),
  1::bigint,
  'Learner A sees only their own module progress'
);

select is(
  (select count(*) from public.learning_attempts),
  1::bigint,
  'Learner A sees only their own completed attempts'
);

update public.module_progress
set last_section_id = 'blocked-cross-user-update'
where user_id = '22222222-2222-4222-8222-222222222222';

update public.module_progress
set last_section_id = 'learner-a-update'
where user_id = '11111111-1111-4111-8111-111111111111';

reset role;

select is(
  (
    select last_section_id
    from public.module_progress
    where user_id = '22222222-2222-4222-8222-222222222222'
      and module_id = 'processing-v3'
  ),
  'overview',
  'Learner A cannot update Learner B progress'
);

select is(
  (
    select last_section_id
    from public.module_progress
    where user_id = '11111111-1111-4111-8111-111111111111'
      and module_id = 'fixation-v3'
  ),
  'learner-a-update',
  'Learner A can update their own progress'
);

select is(
  (
    select revision
    from public.module_progress
    where user_id = '11111111-1111-4111-8111-111111111111'
      and module_id = 'fixation-v3'
  ),
  2::bigint,
  'Own mutable progress update increments the server revision'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.learning_attempts),
  1::bigint,
  'Learner B sees only their own completed attempts'
);

select is(
  (select attempt_id from public.learning_attempts limit 1),
  'attempt-learner-b',
  'Learner B cannot see Learner A attempt identifiers'
);

reset role;

select * from finish();
rollback;
