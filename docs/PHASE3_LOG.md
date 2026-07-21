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
