# Suno sample data

This directory contains small, versioned fixtures for the Suno demo and its automated checks. It is deliberately part of the main repository so reviewers can inspect exactly what drives the golden-audio harness.

| Item | Use |
| --- | --- |
| [`golden-set.json`](./golden-set.json) | The typed manifest of cases, expected outcomes, passage IDs, and seeded student IDs. |
| [`golden/`](./golden/) | Eight curated MP4 fixtures: seven required cases plus an optional Hindi quality gate. |
| [`mock_analysis.json`](./mock_analysis.json) | A static analysis fixture used by development/demo views. |

The files under `golden/` are approved only for this project’s documented demo, repository, and automated-harness purpose. Do not add personal recordings, identifiable video, or a new child recording without the consent and review requirements in [`golden/README.md`](./golden/README.md).

Run `npm.cmd run test:golden` for the offline manifest/contract test. With configured local Supabase and OpenAI credentials, `npm.cmd run golden` performs the authenticated end-to-end test and deletes only the temporary objects and unconfirmed drafts created by its own run.
