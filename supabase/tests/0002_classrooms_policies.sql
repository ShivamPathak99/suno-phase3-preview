-- Run this against a disposable Supabase database after applying migrations.
-- It uses one transaction as the scratch schema and rolls every fixture back.
begin;

-- These IDs are fixtures for a fresh disposable database. A Supabase test
-- database permits seeding auth.users directly from its privileged test role.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
    'rls-teacher-a@example.test', 'not-used', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
    'rls-teacher-b@example.test', 'not-used', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.classrooms (id, teacher_id, name, is_demo) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Teacher A', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Teacher B', false),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'Demo classroom', true);

insert into public.students (id, classroom_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aarti'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bina'),
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Demo child');

insert into public.passages (id, body) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'RLS test passage');

insert into public.assessments (student_id, passage_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

insert into public.worksheets (content_json) values
  ('{"studentId":"aaaaaaaa-0000-0000-0000-000000000001"}'::jsonb),
  ('{"studentId":"bbbbbbbb-0000-0000-0000-000000000001"}'::jsonb),
  ('{"studentId":"dddddddd-0000-0000-0000-000000000001"}'::jsonb);

-- Authorized teacher read, then cross-tenant denial.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
begin
  if exists (
    select 1 from public.classrooms
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ) then
    raise exception 'teacher A should not see teacher B classroom';
  end if;
  if exists (
    select 1 from public.students
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'
  ) then
    raise exception 'teacher A should not see teacher B student';
  end if;
  if exists (
    select 1 from public.assessments
    where student_id = 'bbbbbbbb-0000-0000-0000-000000000001'
  ) then
    raise exception 'teacher A should not see teacher B assessment';
  end if;
  if exists (
    select 1 from public.worksheets
    where content_json ->> 'studentId' = 'bbbbbbbb-0000-0000-0000-000000000001'
  ) then
    raise exception 'teacher A should not see teacher B worksheet';
  end if;
end;
$$;

-- An unauthenticated demo caller can see and write only demo-chain rows.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if not exists (
    select 1 from public.students
    where id = 'dddddddd-0000-0000-0000-000000000001'
  ) then
    raise exception 'anonymous caller should see the demo student';
  end if;
  if exists (
    select 1 from public.students
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ) then
    raise exception 'anonymous caller should not see teacher A student';
  end if;
  if exists (
    select 1 from public.assessments
    where student_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ) then
    raise exception 'anonymous caller should not see teacher A assessment';
  end if;
end;
$$;

update public.students
set name = 'Demo child updated'
where id = 'dddddddd-0000-0000-0000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.students
    where id = 'dddddddd-0000-0000-0000-000000000001'
      and name = 'Demo child updated'
  ) then
    raise exception 'anonymous caller should be able to write demo rows';
  end if;
end;
$$;

rollback;
