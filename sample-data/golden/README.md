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

For `05-adult-scripted-errors.mp4`, use the exact scripted errors recorded in
the manifest: substitute **home** for **school**, skip **small**, self-correct
**tap**, and repeat **plant**. This is what lets the harness verify that the
self-corrected and repeated words end `correct` while the substitution and skip
are caught.
