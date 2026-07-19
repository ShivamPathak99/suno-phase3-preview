create extension if not exists pgcrypto;

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  avatar_seed text,
  is_demo boolean default false
);

create table if not exists passages (
  id uuid primary key default gen_random_uuid(),
  level text check (level in ('letter', 'word', 'paragraph', 'story')),
  language text check (language in ('en', 'hi')),
  title text,
  body text not null
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  passage_id uuid references passages(id),
  audio_url text,
  transcript_json jsonb,
  analysis_json jsonb,
  level text,
  wcpm numeric,
  accuracy numeric,
  teacher_confirmed boolean default false,
  created_at timestamptz default now()
);

create table if not exists worksheets (
  id uuid primary key default gen_random_uuid(),
  level text,
  language text,
  content_json jsonb,
  created_at timestamptz default now()
);
