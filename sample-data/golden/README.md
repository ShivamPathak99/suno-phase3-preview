# Curated golden recordings

`golden-set.json` is the source of truth for the seven required A-6 cases.
Put only curated, consented MP4 or WebM recordings in this directory using the
exact filenames in that manifest:

1. `01-child-decent.mp4`
2. `02-child-struggling.mp4`
3. `03-child-noisy.mp4`
4. `04-adult-fluent.mp4`
5. `05-adult-scripted-errors.mp4`
6. `06-near-silent-4s.mp4`
7. `07-wrong-passage.mp4`

`08-hindi-quality.mp4` is optional and is run only with
`npm run golden -- --include-optional`.

The current `06-near-silent-4s.mp4` container is 5.92 seconds long despite
its historical filename. It exercises the long-quiet Whisper-hallucination
guard; `npm run golden -- --synthetic-only` separately generates the exact
four-second silent audio required by the A-4 acceptance check.

Before adding a child recording, obtain parent consent for the exact purpose
and repository visibility, OpenAI processing, and the brief temporary public
Supabase upload. Remove identifying metadata and use no face video.
Do not copy raw material from `audio_samples/` into this directory until it has
been explicitly approved for this public, curated demo set. Keep the scripted
errors and the intended passage documented in `golden-set.json` before prompt
tuning.

The harness uploads each chosen fixture to a new temporary `audio` object,
runs the frozen upload, transcription, and analysis routes, prints its results,
then deletes that object and any draft assessment it created. It never treats a
golden-model score as a teacher-confirmed assessment.

For `05-adult-scripted-errors.mp4`, the manifest records the verified spoken
fixture: skip **small** and **the**, say **gave** for **give**, while **tap**
and **plant** remain correct. This lets the harness verify both substitutions
and skips without asserting errors that are not in the recording.
