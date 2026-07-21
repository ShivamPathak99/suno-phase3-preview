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

## P3-T5 — User-scoped data access and safe re-authentication

- Replaced service-role access in interactive API routes and server-rendered classroom, assessment, math, and practice queries with the authenticated user’s SSR Supabase client. The remaining service-role client is confined to the approved maintenance paths (seed/reset/create-teacher).
- The audio signed-upload URL is now issued through the child’s authenticated/RLS-scoped session rather than the service role.
- When a session expires during an assessment, the captured recording stays in browser memory. The flow presents “Signed out — sign back in, your recording is safe,” supports either teacher or demo re-authentication in a modal, and resumes the pending upload/assessment after success.
- Added the deterministic 401 recovery contract to the Phase 3 checks. `npm.cmd run check:all` and the production build pass.
- Remaining acceptance on the deployed preview: complete one demo recording and, once a real teacher account is provisioned, complete the same flow under that teacher session.
- Follow-up: audio object paths now include the authenticated user id (`uploads/<user-id>/...`) so the preview Storage policy can grant insert access only to that user's folder. The policy is an operational Storage configuration, not a second Phase 3 application migration.

## P3-T6 — Student API and honest placement resolver

- Added and applied `0003_student_teacher_placement.sql` to the preview project. It stores a teacher’s provisional level independently of assessment evidence.
- Added RLS-scoped `POST /api/students` and `PATCH /api/students/[studentId]`: validated Latin/Devanagari names, optional grade, duplicate-name signal, 60-child advisory, 120-child cap, rename, archive/restore, and manual level changes.
- The shared resolver returns a child’s active placement without manufacturing an assessment: an active teacher override is provisional until the next confirmed benchmark, otherwise the latest confirmed benchmark wins, otherwise the child is unassessed. Archived children are excluded from the live board.
- Benchmark confirmation clears a provisional override; a later manual level change intentionally re-provisionalizes the child (F2-E5). A provisional level is also used to choose the initial reading passage while remaining outside the benchmark model.
- Added deterministic resolver and API route tests. `npm.cmd run check:all` passes; the production build is pending this deployment checkpoint.

## P3-T7 — Student roster UI

- Added the dashboard’s `+ Add child` sheet, with name/grade validation, visible duplicate-name advice that still permits real classmates with the same name, and the optional teacher-estimated starting level.
- Teacher-provisional children appear in their chosen column with a subtle `Teacher placed` chip; rename-only edits are evidence-neutral, while choosing a level explicitly makes a new provisional override.
- Added per-child overflow actions, archive confirmation, demo-reset copy, the quiet archived list, and restore. Archive preserves assessment history and every level column retains its existing empty ghost state.
- Added the P3-T7 UI contract to the Phase 3 suite. `npm.cmd run check:all` passes; manual preview acceptance remains after deployment.

## P3-T8 — Deterministic benchmark passage selector

- Added the pure, offline `passage-selector.ts`: selection is stable from `studentId:confirmedBenchmarkCount`, filters the last two forms and the 21-day memory window, and never blocks a check when a thin pool requires least-recently-read fallback.
- Added explicit baseline passage registration, English difficulty-band validation (word count, mean sentence length, and vocabulary tier), and a deterministic test covering refresh stability, post-confirm rotation, fallback, and Hindi language scoping.

## P3-T9 — Selector integration and passage cycling

- Live benchmark setup now resolves from the deterministic baseline pool rather than a first matching row. The same upcoming form remains stable on refresh; a confirmed benchmark advances the count, while Change passage advances a bounded deterministic offset.
- Added the passage-card explanation, a dev-only thin-pool warning, and a wiring contract for selection, cycling, and the refresh behavior.

## P3-T10 — Protected step-up probe

- A latest confirmed benchmark at 90%+ with no more than one hesitation now selects the next reading level. Teacher-provisional placements and focused practice reads remain ineligible, and story never tries to step beyond the ladder.
- The assessment page explains that the probe cannot move a child down and offers a deterministic base-level alternative. Server-side confirmation promotes at 80% or above, otherwise keeps the prior confirmed level; the boundary and never-demote property are covered by tests.

## P3-T11 — Teacher feedback summary

- Added the pure feedback summary builder for this-read misses, cumulative skill standing, strengths, thin-evidence guidance, and honest untracked-word counts. It derives only from teacher-confirmed adaptive evidence and the same rebuilt profile used by the practice loop.

## P3-T12 — Teacher feedback UI

- Confirming a reading now returns and displays the teacher-only “What this read tells us” block immediately before the Focus panel. It includes kind this-read evidence, an honest untracked-word row, strengths, and thin-evidence guidance; math remains behind its existing capability path rather than presenting a dead panel.

## P3-T13 — Student timeline model

- Added a pure per-student timeline that derives benchmark-only trend points, a separate practice-activity count, diary entries, focus episodes, and the shared profile snapshot. Practice reads remain visible as activity but cannot affect ladder or trend data.

## P3-T14 — Student journey page

- Added `/student/[id]` with designed rich, thin, practice-only, and archived states: benchmark trends, skill map, separate practice activity, and a confirmed-reading diary. Roster names now open the journey page.

## P3-T15 — Parent report

- Added a printable, one-page parent snapshot with strengths, one useful focus, simple home practice, and separate benchmark/practice activity. It gracefully renders when evidence is thin and is linked from every student journey.
