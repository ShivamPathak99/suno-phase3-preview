# Suno

Suno is a teacher-first oral-reading assessment workflow for early-grade classrooms.

## Foundation setup

1. Copy `.env.example` to `.env.local` and add the service credentials when they are available.
2. Install dependencies with `npm.cmd install` on Windows or `npm install` elsewhere.
3. Run `npm run dev`.

The C-1 foundation intentionally contains no live OpenAI or Supabase calls. Those arrive through the frozen Agent A and Agent C tickets.

## Supabase schema and demo seed

1. In the Supabase **suno** project, open **SQL Editor**.
2. Paste and run [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql).
3. With `.env.local` configured, run `npm run seed`.

The seed is idempotent and verifies that it created 20 demo students, 8 passages, and 20 confirmed assessments.

## Audio storage

Run `npm run setup:storage` to create or repair the public `audio` bucket. The command uses only the server-side Supabase key and is safe to re-run.
