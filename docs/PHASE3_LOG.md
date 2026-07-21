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
