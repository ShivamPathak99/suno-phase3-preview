# Phase 3 log

## P3-T0 — Ground truth check (pending acceptance)

- Branch: `phase3`, created from `phase2` commit `3fbde59` (`Fix math review result action layout`). `main` remains at `d46e376` and was not changed.
- Phase 2 Gates G0–G3 are present on the base: deterministic adaptive evidence/profile/selection, confirmation wiring, Focus panel, curated cards, practice-purpose protection, placement exclusion, and the seeded Maya loop (P2-T0 through P2-T14 commits).
- Verification: `npm.cmd run check:all` exited successfully on the Phase 3 base.
- Dirty worktree: only pre-existing user files remain untracked (`AGENT_EXECUTION_PLAN/SUNO_ADAPTIVE_READING_LOOP.md`, `docs/SUNO_CURRENT_CAPABILITIES.pdf`, `files_2.zip`, `files_2/`, `files_3.zip`, `files_3/`). They were not changed.
- Next ticket: P3-T1, after the P3-T0 report is accepted. It is the single sanctioned migration and RLS-policy test ticket.

## P3-T1 — Classroom tenancy migration + RLS

- P3-T0 was accepted. Added the single sanctioned migration, `0002_classrooms.sql`: classrooms plus student tenancy/archive/placement fields, and an owner-or-demo RLS policy for every scoped table.
- Worksheets retain their established `content_json.studentId` tenancy reference. Individual and `group:<student-id>:...` cards both chain through a classroom; unlinked legacy rows are denied to browser roles.
- Added an offline scratch-policy truth-table test and a transaction-rollback SQL harness for a disposable Supabase database. The Node policy suite is part of `check:all`.

## P3-T2 — Demo seed, reset, and benchmark pool

- Seed now creates one `is_demo=true` classroom and attaches every deterministic demo child to it. Reset removes only that classroom chain, including demo-linked worksheets, before reseeding.
- Added three English baseline forms per reading level. The realistic demo text has explicit `demo_placeholder` calibration metadata and needs human calibration before a pilot.
- Seeded dated confirmed history across the F6.2 four-to-eight-week window: Chitra's benchmark promotion, Maya's completed focus episode, and Arjun's resolved dropped-carry math arc.
- Added the P3-T2 seed/idempotence test to `test:phase3`. Migration `0002` was then applied to the configured preview project; `seed` completed with 20 demo students, 19 passages, and 27 deterministic assessments. A reset dry run correctly scopes all 30 current demo assessments and leaves non-demo rows untouched.

## P3-T3 — Login, provisioning, and route protection

- Added the approved `@supabase/ssr` clients, `/login`, protected-page middleware with safe return paths, and a quiet teacher account/sign-out menu.
- Added `npm.cmd run create-teacher -- --email teacher@example.com --classroom "Class 3A" [--grade 3]`. It creates the auth user and classroom, then prints a one-time set-password link instead of sending email in preview.
- Automated auth contracts, `npm.cmd run check:all`, and the production build pass. Manual acceptance remains: provision an actual teacher email and confirm that account reaches its empty owned classroom.

## P3-T4 — Demo door and sandbox protection

- Activated the first-class login demo button: it creates (or reuses) a Supabase anonymous session, preserves the safe `next` destination, and enters the seeded demo classroom through the existing RLS chain.
- Added the F1.2 soft cap in `src/lib/auth/openai-rate-limit.ts`: 30 OpenAI-backed calls per hour per Supabase session across transcription, analysis, and worksheets. It returns 401 before an unsigned call reaches a model and 429 with `Retry-After` when capped. Its deterministic unit test is part of `test:phase3`.
- Added the protected `/api/cron/reset-demo` endpoint and `vercel.json` schedule. The preview default is 02:00 Asia/Kolkata (20:30 UTC); the route requires both a matching `CRON_SECRET` and `SUNO_DEMO_RESET_TARGET=phase3-preview` before it can change demo data.
- During local smoke verification, a signed-out route exposed that Next 16 does not load a root request guard when the app lives in `src/app`. The guard is now `src/proxy.ts` (the current Next 16 convention), and production-mode checks confirm `/` and deep links redirect to `/login?next=...` while `/login` remains reachable.
- Remaining manual preview setup: enable Supabase anonymous sign-ins, then set the same random `CRON_SECRET` and `SUNO_DEMO_RESET_TARGET=phase3-preview` in the phase3 preview deployment environment before relying on the live nightly reset.
