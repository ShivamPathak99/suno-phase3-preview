-- Phase 3 follow-up: `placement_source` records whether a child is currently
-- teacher-provisional or benchmark-placed. This column holds the teacher's
-- provisional level without creating a synthetic assessment/evidence row.
alter table public.students
  add column if not exists teacher_placement_level text
    check (teacher_placement_level in ('letter', 'word', 'paragraph', 'story'));
