-- Phase 3's only schema migration. A classroom is the tenancy boundary for
-- teacher data and the shared demo classroom.
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id),
  name text not null,
  grade text,
  is_demo boolean not null default false
);

alter table public.students
  add column if not exists classroom_id uuid references public.classrooms(id),
  add column if not exists is_archived boolean not null default false,
  add column if not exists placement_source text not null default 'benchmark'
    check (placement_source in ('teacher', 'benchmark'));

-- RLS is deliberately applied to the whole chain. A signed-in teacher can
-- access only rows in their classroom; the demo classroom remains writable to
-- anonymous demo sessions and is reset by the privileged reset script.
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.assessments enable row level security;
alter table public.worksheets enable row level security;

grant select, insert, update, delete on public.classrooms to anon, authenticated;
grant select, insert, update, delete on public.students to anon, authenticated;
grant select, insert, update, delete on public.assessments to anon, authenticated;
grant select, insert, update, delete on public.worksheets to anon, authenticated;

drop policy if exists classrooms_access on public.classrooms;
create policy classrooms_access
on public.classrooms
as permissive
for all
to anon, authenticated
using (
  teacher_id = (select auth.uid())
  or is_demo = true
)
with check (
  teacher_id = (select auth.uid())
  or is_demo = true
);

drop policy if exists students_access on public.students;
create policy students_access
on public.students
as permissive
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.classrooms classroom
    where classroom.id = students.classroom_id
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
)
with check (
  exists (
    select 1
    from public.classrooms classroom
    where classroom.id = students.classroom_id
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
);

drop policy if exists assessments_access on public.assessments;
create policy assessments_access
on public.assessments
as permissive
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.students student
    join public.classrooms classroom on classroom.id = student.classroom_id
    where student.id = assessments.student_id
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
)
with check (
  exists (
    select 1
    from public.students student
    join public.classrooms classroom on classroom.id = student.classroom_id
    where student.id = assessments.student_id
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
);

-- Worksheets predate the classroom table. Their established content contract
-- contains either an individual studentId or a `group:<student-id>:...` ID;
-- that immutable relationship is the worksheet's tenancy chain. Unlinked
-- legacy rows are intentionally inaccessible to browser clients.
drop policy if exists worksheets_access on public.worksheets;
create policy worksheets_access
on public.worksheets
as permissive
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.students student
    join public.classrooms classroom on classroom.id = student.classroom_id
    where (
      student.id::text = coalesce(
        worksheets.content_json ->> 'studentId',
        worksheets.content_json -> 'adaptive' ->> 'studentId'
      )
      or (
        coalesce(
          worksheets.content_json ->> 'studentId',
          worksheets.content_json -> 'adaptive' ->> 'studentId',
          ''
        ) like 'group:%'
        and position(
          ':' || student.id::text || ':'
          in ':' || coalesce(
            worksheets.content_json ->> 'studentId',
            worksheets.content_json -> 'adaptive' ->> 'studentId',
            ''
          ) || ':'
        ) > 0
      )
    )
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
)
with check (
  exists (
    select 1
    from public.students student
    join public.classrooms classroom on classroom.id = student.classroom_id
    where (
      student.id::text = coalesce(
        worksheets.content_json ->> 'studentId',
        worksheets.content_json -> 'adaptive' ->> 'studentId'
      )
      or (
        coalesce(
          worksheets.content_json ->> 'studentId',
          worksheets.content_json -> 'adaptive' ->> 'studentId',
          ''
        ) like 'group:%'
        and position(
          ':' || student.id::text || ':'
          in ':' || coalesce(
            worksheets.content_json ->> 'studentId',
            worksheets.content_json -> 'adaptive' ->> 'studentId',
            ''
          ) || ':'
        ) > 0
      )
    )
      and (
        classroom.teacher_id = (select auth.uid())
        or classroom.is_demo = true
      )
  )
);
