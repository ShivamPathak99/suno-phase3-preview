# Suno

Suno is a teacher-first oral-reading assessment workflow for early-grade classrooms.

For the current capabilities, screenshots, technical architecture, verification commands, and known demo limits, see [Suno Current Capabilities & Technical Guide](./docs/SUNO_CURRENT_CAPABILITIES.md).

## Local setup

1. Copy `.env.example` to `.env.local` and add the service credentials when they are available.
2. Install dependencies with `npm.cmd install` on Windows or `npm install` elsewhere.
3. Run `npm run dev`.

The current build uses Supabase for seeded classroom data and direct signed audio uploads, OpenAI transcription for timestamped speech-to-text, and GPT-5.6 for strict reading analysis and worksheet generation.

## Supabase schema and demo seed

1. In the Supabase **suno** project, open **SQL Editor**.
2. Paste and run [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql).
3. With `.env.local` configured, run `npm run seed`.

The seed is idempotent and verifies that it created 20 demo students, 11 passages (including the Math V1 sentinel), and 24 confirmed assessments. Maya&apos;s two saved practice reads demonstrate the adaptive loop without changing her Word-level classroom placement.

## Phase 2 demo reset

`reset-demo` is for a **Phase 2 preview/development Supabase project only**. Point `.env.local` at that project first; never use the production project or its credentials.

Run a read-only preflight first:

```powershell
npm.cmd run reset-demo -- --dry-run
```

Then explicitly acknowledge the preview target in the same PowerShell session before resetting:

```powershell
$env:SUNO_DEMO_RESET_TARGET = "phase2-preview"
npm.cmd run reset-demo
```

The command deletes only `students.is_demo = true` and assessments belonging to those students, then restores the deterministic seed. It leaves non-demo students, their assessments, and all worksheets untouched. Seed passages are inserted only when missing, so an existing shared passage is never overwritten.

## Audio storage

Run `npm run setup:storage` to create or repair the public `audio` bucket. The command uses only the server-side Supabase key and is safe to re-run.

## Golden-set harness

Run `npm run test:golden` to validate the harness contract without any network
or audio upload. Curated fixtures and their expected outcomes live in
[`sample-data/golden-set.json`](./sample-data/golden-set.json); see
[`sample-data/golden/README.md`](./sample-data/golden/README.md) before adding
a recording.

With all seven approved fixtures present, `npm run golden` starts a local API
server, runs every fixture through the signed upload, transcription, and
analysis routes, prints a side-by-side table, and cleans up the temporary
storage objects and draft assessments. Use
`npm run golden -- --base-url https://your-deployment.example` to exercise a
deployment you control, `--isolated-local` to build and run a separate local
production server, or `--include-optional` to run the separate Hindi quality
gate. The command does not automatically reuse an already-running server: set
an explicit `--base-url` only when you have verified that endpoint. A `REVIEW`
row means the fixture needs a human baseline; it returns a non-zero exit code
until the manifest has deterministic expectations. Until the curated fixtures
are added, the command intentionally stops before making network calls and
lists the missing files.

## Pipeline notes

The pipeline makes two deliberate safety choices: it rejects short, sparse, or
implausibly fast transcripts before GPT-5.6 is called, and it keeps the
teacher-facing analysis object separate from the draft `assessmentId`. The
golden harness exercises the frozen HTTP boundaries rather than internal
helpers, but only processes curated recordings explicitly approved for OpenAI
processing, temporary public storage, and repository visibility. Its temporary
objects and unconfirmed drafts are matched to the individual run before
cleanup.

## Worksheet generator

`POST /api/worksheets` accepts `{ "level", "language" }` and returns only the
frozen worksheet JSON shape: `{ "title", "body", "question" }`. Generation
uses GPT-5.6 Structured Outputs, then the server checks the level-specific body
length and that the card contains one short question. Run `npm run test:worksheets`
for the offline contract check. With `OPENAI_API_KEY` configured,
`npm run verify:worksheets` exercises the route against GPT-5.6 for all four
English levels.
