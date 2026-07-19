# Suno — Multi-Agent Execution Plan
### OpenAI Build Week · Education Track · 2-Day Build

> Companion to `PROJECT.md` (product + architecture). This document is the **operating manual**: who builds what, in which session, in what order, with every known edge case pre-decided.
> Deadline: **Tue, Jul 21, 5:00 PM PDT = Wed, Jul 22, 5:30 AM IST.** Internal deadline: **Tue 11:59 PM IST.**

---

## 0. THE ORCHESTRATION MODEL (read first — a hackathon rule shapes it)

**Rule constraint:** the submission requires a `/feedback` Codex Session ID from the session containing **the majority of core functionality**. Four fully independent agents in four sessions would leave no such session — an instant compliance failure.

**Fix — hub and spoke:**

```
                    ┌──────────────────────────────┐
                    │  HUMAN ORCHESTRATOR (you)     │
                    │  gates · cuts · physical world│
                    └──────┬───────────────┬───────┘
                           │               │
              ┌────────────▼─────────┐  ┌──▼─────────────────────┐
              │  MAIN CODEX SESSION  │  │  SPOKE SESSIONS         │
              │  (the /feedback ID)  │  │  (separate, non-core)   │
              │  Agent A → pipeline  │  │  Agent D → narrative,   │
              │  Agent B → screens   │  │  video script, README   │
              │  Agent C → platform, │  │  prose, Devpost text,   │
              │  worksheets, print   │  │  passage content        │
              └──────────────────────┘  └────────────────────────┘
```

- **Agents A, B, C are role prompts inside ONE Main Codex Session.** You switch roles by pasting the agent's boot prompt; all core code accumulates in this session. This satisfies the rule *and* gives each agent full context of the others' code.
- **Agent D runs in separate sessions** (Codex or any assistant) — legitimate, because D produces no core functionality.
- **The human orchestrator** does what no agent can: records children, judges UI feel by hand, runs the stranger test, shoots video, clicks Submit, and enforces the gates below.
- Sequencing within the hub: agents take turns per the schedule (§6); never interleave two agents' half-finished tasks. Finish a ticket, commit, switch roles.

**Escalation rule for every agent:** if blocked > 25 minutes on one bug, stop, write a one-line status, and surface to the orchestrator. The orchestrator decides: retry differently, cut, or fallback. No silent rabbit holes — 25 minutes is 2% of the total budget.

---

## 1. SHARED FROZEN CONTRACTS (Hour 0 — no agent may change these unilaterally)

### 1.1 The mock analysis file — `sample-data/mock_analysis.json`
This file IS the A↔B contract. Agent C commits it in the first hour; Agent B builds every screen against it; Agent A's real pipeline must emit exactly this shape.

```json
{
  "level": "word",
  "wcpm": 21.4,
  "accuracy_pct": 68.0,
  "words": [
    { "passage_word": "The",    "status": "correct",     "heard_as": null,     "confidence": "high" },
    { "passage_word": "cat",    "status": "correct",     "heard_as": null,     "confidence": "high" },
    { "passage_word": "sat",    "status": "substituted", "heard_as": "sit",    "confidence": "medium" },
    { "passage_word": "on",     "status": "skipped",     "heard_as": null,     "confidence": "high" },
    { "passage_word": "the",    "status": "correct",     "heard_as": null,     "confidence": "high" },
    { "passage_word": "brown",  "status": "hesitation",  "heard_as": "brown",  "confidence": "medium" },
    { "passage_word": "mat",    "status": "unclear",     "heard_as": null,     "confidence": "low" }
  ],
  "summary_for_teacher": "Ravi reads common words confidently but skips connector words and pauses on longer ones. He is solidly at word level, approaching paragraph.",
  "recommended_focus": "Blending two-syllable words"
}
```

### 1.2 Structured-output schema — STRICT MODE RULES
OpenAI strict structured outputs require **every field present** (no optionals). Nullable fields must be typed as `["string","null"]` unions. `additionalProperties: false` everywhere. Enums exactly: `level ∈ {letter, word, paragraph, story}`, `status ∈ {correct, substituted, skipped, hesitation, unclear}`, `confidence ∈ {high, medium, low}`. Agent A owns the JSON-Schema file at `lib/analysisSchema.ts`; Agent B imports the TS type generated from it. One source of truth.

### 1.3 Other frozen artifacts
- **DB schema** — as in `PROJECT.md` §2.3 (4 tables, JSONB blobs, no later migrations).
- **API surface** — 5 routes, `PROJECT.md` §2.4, with one amendment from stress-testing: **`POST /api/upload` is replaced by client-direct upload to Supabase Storage via signed URL** (see edge case C-3). The route becomes `POST /api/upload-url` → returns signed URL; browser PUTs the file itself.
- **Level colors (app-wide constants):** letter = red family, word = amber, paragraph = blue, story = green. Same four everywhere: heatmap, confirm screen, worksheets, video graphics.
- **Definition of done (the stranger test):** stranger opens URL → sees full classroom → records themselves reading badly → errors caught on confirm screen → fixes one word → confirms → appears on heatmap → prints worksheet — with zero help.

---

## 2. AGENT A — PIPELINE OWNER
*Everything between the microphone and the JSON. The project lives or dies here, so A goes first and A's risk spike gates the entire build.*

### 2.1 Boot prompt (paste into Main Session when A's turn starts)
> You are Agent A, the pipeline owner. You own: audio capture format handling, signed-URL upload flow, transcription with word timestamps, GPT-5.6 structured analysis, and the golden-set test harness. You must honor the frozen contracts in PROJECT.md §2.3–2.6 and AGENT_EXECUTION_PLAN.md §1 exactly. Build in ticket order A-1…A-6. Write terse commit messages per ticket. If a contract seems wrong, stop and ask the orchestrator — never change it silently.

### 2.2 Tickets (in order)
| # | Ticket | Done when | Budget |
|---|---|---|---|
| A-1 | **Risk spike**: bare Node script — local child recording → transcription endpoint (word timestamps) → print words+times | Real child audio returns sane timestamped words | 45 min, tonight, before anything |
| A-2 | `POST /api/upload-url` (signed Supabase URL) + client PUT helper | curl flow stores a file, returns public URL | 45 min |
| A-3 | `POST /api/transcribe` — accepts `{audioUrl}`, calls transcription, returns `{words[], text, durationSec}` | Works via curl on golden files | 1 h |
| A-4 | **Pre-analysis guard** (see edge cases A-4/A-5): duration, word-count, silence checks → structured "unassessable" response | Silent clip returns guard response, never reaches GPT | 45 min |
| A-5 | `POST /api/analyze` — GPT-5.6 strict structured output vs frozen schema; persists draft assessment | Golden files → valid JSON matching mock shape | 2 h |
| A-6 | **Golden-set harness** — `npm run golden` runs all sample files through pipeline, prints table (level, wcpm, errors found) | One command, side-by-side results | 1 h |

### 2.3 Edge-case matrix — Agent A
| # | Case | Handling (pre-decided) |
|---|---|---|
| A-EC1 | **ASR hallucination on silence** (Whisper-family models invent text for silent audio) | Guard before analysis: reject if `durationSec < 5` OR transcript `< 3` words OR words/second implausible (> 5). Return `{unassessable: true, reason}` |
| A-EC2 | Child says nothing / whispers | Same guard; UI shows "Couldn't hear the reading — try again closer to the child" (B renders it) |
| A-EC3 | Heavy background noise (classroom!) | Prompt instructs: score only aligned words; unmatched noise → ignore. Golden set includes a noisy clip; tune until it passes |
| A-EC4 | Child reads a DIFFERENT text than shown | Alignment yields near-zero matches → if `accuracy < 15%` AND `words > 10`, return `{unassessable, reason: "reading did not match the passage"}` — never classify garbage as "letter level" |
| A-EC5 | Self-corrections ("sat— no, sit… sat") | Prompt rule: a word eventually read correctly = `correct`; harness verifies on a scripted self-correction clip |
| A-EC6 | Repeated words / re-reads a line | Prompt rule: ignore repetitions; count passage word once |
| A-EC7 | Fluent adult voice (judges WILL test with their own voice) | Must classify cleanly as `story` with ~100% accuracy; golden set includes an adult clip |
| A-EC8 | Adult deliberately reading badly (judges do this too) | Substitutions/skips must be caught in an adult timbre — golden set includes scripted-errors adult clip |
| A-EC9 | Hindi audio quality lower than English | Hindi is Tier-3: enable ONLY if a Hindi golden clip passes A-6; otherwise app ships English with Hindi marked "coming next" |
| A-EC10 | Transcription API error / rate limit / timeout | One retry with backoff; then friendly failure to client; never a raw 500. All OpenAI calls wrapped in a single `callOpenAI()` helper with retry + timeout (30 s) |
| A-EC11 | GPT returns schema-invalid output | Strict mode largely prevents it; still validate server-side (zod) and one retry with "your last output failed validation: {error}" |
| A-EC12 | `wcpm` division by zero (0-duration audio) | Guard A-EC1 catches it; belt-and-braces: `durationSec = max(durationSec, 1)` |
| A-EC13 | iOS Safari records mp4/aac, Chrome webm/opus | Detect MIME from blob; send correct filename/extension to the API (it accepts both). Demo path = Chrome; iOS = supported but untested claim removed from README |
| A-EC14 | Very long recording (child keeps phone) | Client hard-stops recording at 120 s; passage lengths sized for < 90 s |
| A-EC15 | Upload dies mid-PUT (school connectivity) | Client retry ×2; audio blob retained in memory so re-try needs no re-recording |

### 2.4 Acceptance tests (A cannot hand off until all pass)
Golden set = 7 files, committed to `sample-data/`: (1) real child, decent reader; (2) real child, struggling reader; (3) real child, noisy background; (4) adult fluent; (5) adult with scripted errors; (6) 4-second near-silent clip; (7) child/adult reading the wrong passage. `npm run golden` must show: 1–5 produce sensible levels & error words; 6–7 produce guard responses. **This table is screenshot-worthy — D uses it in the README.**

### 2.5 Handoff artifacts
Live routes on the deployed URL · `analysisSchema.ts` + generated TS types · golden harness + results table · a one-paragraph "pipeline notes" block for D's README (including 2 concrete "Codex decided X" moments logged while fresh).

---

## 3. AGENT B — PRODUCT OWNER
*The confirm screen and the heatmap — the two screens judges actually score. Builds against `mock_analysis.json` from minute one; swaps to the live pipeline only at Gate 3.*

### 3.1 Boot prompt
> You are Agent B, the product owner. You own the assess flow UI (record screen, staged progress, confirm screen) and the dashboard heatmap. Build everything against `sample-data/mock_analysis.json` and seeded demo data — do NOT wait for or call the live pipeline until the orchestrator says "Gate 3". Design register: calm professional teacher tool, one accent color, the four frozen level colors, large tap targets. Ticket order B-1…B-5.

### 3.2 Tickets
| # | Ticket | Done when | Budget |
|---|---|---|---|
| B-1 | Record screen: passage display (large type), mic permission flow, record/stop, 120 s cap, staged progress states ("Uploading… Listening… Checking each word…") | Full flow runs on mock (fake 2 s delays) | 2 h |
| B-2 | **Confirm screen**: word-by-word color coding (correct/substituted/skipped/hesitation/unclear), low-confidence flags, tap-a-word → override menu (mark correct / mark error / edit heard-as), level card, WCPM + accuracy, teacher summary, Confirm button | Pixel-polished on mock; the app's best screen | 3 h |
| B-3 | Dashboard heatmap: four level columns, student cards (name + last-assessed + trend arrow), suggested groups panel, per-student Assess button | Renders 20 seeded students; new assessment slots in | 2 h |
| B-4 | **"Load sample recording" button** on record screen (plays + processes a bundled golden file) | Judge with no mic / muted mic still experiences the full flow | 45 min |
| B-5 | Error & empty states: mic denied, upload failed, unassessable (A-EC1/2/4 reasons verbatim), zero-assessment student card | Every failure has a designed, kind message | 1 h |

### 3.3 Edge-case matrix — Agent B
| # | Case | Handling |
|---|---|---|
| B-EC1 | Judge denies mic permission | Inline explainer + retry + point to Sample Recording button (B-4). Never a dead end |
| B-EC2 | Judge on desktop with no mic at all | B-4 is the path; button copy: "No mic? Try a sample child recording" |
| B-EC3 | `unassessable` responses | Distinct friendly screens per reason; a Retry that keeps the same student/passage |
| B-EC4 | Very long student names / Hindi names | Truncate with ellipsis on cards; full name on assess screen |
| B-EC5 | All students in one level (post-judge-clicking chaos) | Heatmap columns must not collapse; empty columns render with a ghost state |
| B-EC6 | Re-assessing an already-assessed student | Latest assessment wins for placement; card shows count ("3 assessments") |
| B-EC7 | Teacher overrides EVERY word | Recompute accuracy/level client-side on confirm? **No — pre-decided: overrides stored, level recomputed server-side on confirm** (single source of truth) |
| B-EC8 | Long passage overflows confirm screen on phone | Wrap naturally; sticky level card; test at 360 px width |
| B-EC9 | Double-tap Confirm / double submission | Disable button on first click; idempotent confirm endpoint (C ensures) |
| B-EC10 | Judge opens app mid-assessment via direct URL | Every route renders standalone from seeded data; no client-only state required to land anywhere |
| B-EC11 | Dark-room video shoot legibility | Contrast-check the four level colors; error red ≠ level red confusion → use distinct shade + icon |
| B-EC12 | Progress stage hangs (network) | Each stage has a 45 s client timeout → error state, never an infinite spinner on camera |

### 3.4 Acceptance tests
Confirm screen renders mock JSON flawlessly at 360 px and 1440 px · all five word-status styles visibly distinct without reading a legend · heatmap slot-in animation on new confirm · every B-5 state reachable via a `?debug=` query for the video shoot · Lighthouse tap-target pass on the two hero screens.

---

## 4. AGENT C — PLATFORM + CONTENT OWNER
*Repo, DB, seed, deploy, worksheets, print. C ships to production in hour one and keeps `main` deployable every hour after.*

### 4.1 Boot prompt
> You are Agent C, platform owner. You own scaffold, Supabase schema + seed, Vercel deployment, the worksheet generator, print CSS, and demo-data integrity. Deployment is continuous: after every merged ticket, the live URL must pass the walking-skeleton check. Ticket order C-1…C-6.

### 4.2 Tickets
| # | Ticket | Done when | Budget |
|---|---|---|---|
| C-1 | Scaffold: Next.js + TS + Tailwind + supabase-js, MIT LICENSE, `.env.example`, deployed hello-world on Vercel | Live URL exists, tonight | 1 h |
| C-2 | Migration + seed: 4 tables; 8 passages (4 levels × EN/HI — bodies from Agent D); **20 demo students with pre-baked assessments** distributed across levels; `npm run seed` idempotent | Fresh DB → one command → populated board | 1.5 h |
| C-3 | Supabase Storage: `audio` bucket, signed-URL upload route, public read | Browser PUTs a file end-to-end | 45 min |
| C-4 | `POST /api/worksheets` — GPT-5.6 generates level-matched reading card (title, body, one comprehension question) | Valid JSON for all 4 levels EN | 1 h |
| C-5 | Print route + `@media print` CSS | Ctrl+P → clean A4, no nav/buttons | 45 min |
| C-6 | **Demo-integrity kit**: `npm run reset-demo` restores seeded state; demo students flagged `is_demo` | One command undoes judge/test chaos before video shoot | 30 min |

### 4.3 Edge-case matrix — Agent C
| # | Case | Handling |
|---|---|---|
| C-EC1 | **Vercel serverless body limit (~4.5 MB)** would break audio POSTs | Solved by design: client-direct signed-URL upload (C-3); API routes only ever carry JSON |
| C-EC2 | Serverless timeout on analyze | 3-call orchestration keeps each < 15 s; set `maxDuration: 60` on API routes as belt-and-braces |
| C-EC3 | Supabase bucket privacy misconfig → audio URLs 403 in production | Deploy-day checklist item: fetch an audio URL from an incognito browser |
| C-EC4 | `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` leaked client-side | Keys only in server routes; grep bundle for key prefixes as a CI-ish check; `.env.example` documents which are public |
| C-EC5 | Seed re-run duplicates students | Idempotent by stable UUIDs / upsert |
| C-EC6 | Judges mutate demo data days after submission (judging period!) | `is_demo` flag + a scheduled-free approach: reset script documented in README so we can restore anytime; confirm endpoint never deletes |
| C-EC7 | **OpenAI billing** (free-credit window closed Jul 17) | Own API key with a **hard usage limit set (e.g., $25)** in the OpenAI dashboard; cost estimate: transcription ≈ $0.006/min, analysis calls cents each → whole build + judging < $10, but the cap prevents a retry-loop bill |
| C-EC8 | GPT-5.6 model access/naming | Verify exact model string against the API docs on Day 1 (rules require GPT-5.6 — do not silently fall back to another model; if account lacks access, resolve tonight, not Tuesday) |
| C-EC9 | Worksheet generation returns culturally odd / too-hard text | Prompt pins: Indian primary-school context, familiar vocabulary, word-count band per level; D reviews all 4 levels once |
| C-EC10 | Print CSS renders blank in Chrome print preview | Known trap: avoid `position: fixed` in print; test Ctrl+P as part of C-5 done-criteria, not after |
| C-EC11 | Cold-start latency on first judge click | Keep a warm ping (or accept 1–2 s; do NOT burn time on this — accepted risk) |
| C-EC12 | Vercel env vars missing on redeploy | `.env.example` + deploy checklist; app fails loudly with a readable message if a key is absent |

### 4.4 Acceptance tests
Fresh clone → `README` quickstart → running locally in < 10 min (C times it) · live URL passes walking-skeleton check after every merge · incognito audio-URL fetch works · `npm run reset-demo` verified · Ctrl+P on all 4 worksheet levels.

---

## 5. AGENT D — NARRATIVE OWNER (separate sessions; no core code)
*Video, README, Devpost text, recordings, passages, end-user testing. In a 38,000-entrant field, this seat converts a good build into a winning submission.*

### 5.1 Boot prompt (for D's assistant sessions)
> You are Agent D, narrative owner. You produce: leveled reading passages (EN + HI), the README, the Devpost description, the sub-3-minute video script and shot list, and the stranger-test protocol. Product truth lives in PROJECT.md; never claim anything the demo doesn't show. Tone: evidence-first, zero hype words ("revolutionary", "game-changing" banned).

### 5.2 Tickets
| # | Ticket | Done when | When |
|---|---|---|---|
| D-1 | **Child recordings** (the project's most time-critical physical task): 3–4 children if possible, else siblings/neighbors' kids, else adults mimicking — reading level-appropriate passages, phone mic, ordinary room noise. **Get verbal parent consent; first names only; no faces needed for audio.** Also record: one noisy clip, one near-silent clip, one wrong-passage clip, one fluent adult, one scripted-errors adult | 7-file golden set delivered to A | Tonight |
| D-2 | 8 passages written (4 ASER levels × EN/HI), Indian context, sized to read in < 90 s | Handed to C for seeding | Tonight |
| D-3 | README: problem (with the evidence table from PROJECT.md §1.2) → quickstart → sample data → architecture summary → **"How we used Codex + GPT-5.6" section with 3–4 concrete decisions** → honest limitations → next steps (validation study) | Reviewed by orchestrator | Day 2 AM |
| D-4 | Devpost form text: title, 198-char pitch (locked in PROJECT.md), full description, track = Education | Pasted-ready doc | Day 2 AM |
| D-5 | Video: script (locked cold open) → shot list → record vs LIVE deployed URL with pre-verified golden recordings → edit to **≤ 2:40** → upload YouTube **public** → verify playback logged-out | Link plays in incognito | Day 2 PM |
| D-6 | **Stranger test** ×2 (one tech friend, one non-tech) on the live URL; file bugs as one-liners | Both complete the loop unaided | Day 2, 4 PM |
| D-7 | Submission execution: all fields, repo link, video link, `/feedback` Session ID (orchestrator runs `/feedback` in Main Session), team members added on Devpost, Submit, screenshot confirmation | Confirmation screenshot exists | Tue ≤ 11:59 PM IST |

### 5.3 Edge-case matrix — Agent D
| # | Case | Handling |
|---|---|---|
| D-EC1 | No children available tonight | Fallback ladder pre-agreed: relatives' kids by phone call → neighbor kids → adults deliberately mimicking early readers (label honestly in README as "simulated samples + N real child samples") |
| D-EC2 | Parent consent hesitation | Audio only, first name or pseudonym, offer to play them the clip, delete-on-request promise. If any doubt — don't use the clip |
| D-EC3 | Video runs over 3:00 | Script to 2:40; the cut order for video content: Codex b-roll → worksheet segment → parent voice note. Cold open and confirm-screen moment are never cut |
| D-EC4 | **YouTube processing lag / stuck at 360p** at deadline | Upload by Tue 6 PM IST (6+ h buffer); verify in incognito; HD not required by rules but processing completion is |
| D-EC5 | Video accidentally unlisted/private | Rules say public — checklist item: open link in logged-out browser |
| D-EC6 | Repo private without judge access | Default: **public + MIT**. If private for any reason: add testing@devpost.com AND build-week-event@openai.com, verify invites sent |
| D-EC7 | `/feedback` returns no ID / command confusion | Run it Day 2 afternoon (not at 11 PM); if it fails, screenshot the session + contact Devpost manager (shawni@devpost.com) BEFORE deadline |
| D-EC8 | Teammates not registered on Devpost | All team members registered + added to the project by Tue evening; eligibility: age of majority, eligible country (India ✔) |
| D-EC9 | Timezone slip | Every calendar entry in IST; the ONLY deadline that matters internally: **Tue 11:59 PM IST** |
| D-EC10 | Overclaiming in README/video ("solves illiteracy", "99% accurate") | D's ban list + the rule: every quantitative claim needs a source or a demo. "Teacher-confirmed by design; formal validation is our next step" is the accuracy sentence |
| D-EC11 | Devpost form has an unexpected required field | Do a **dry-run of the form Day 2 morning** (open it, screenshot all fields) so nothing surprises at night |
| D-EC12 | Judges never read READMEs fully | First screen of README = pitch + 3 screenshots + golden-set results table + one-click demo link |

### 5.4 Acceptance tests
Video < 3:00, public, plays logged-out · README quickstart timed on a fresh machine by C · both stranger tests pass · Devpost preview screenshot reviewed by orchestrator · confirmation screenshot saved.

---

## 6. ORCHESTRATOR SCHEDULE & GATES (all times IST)

### Tonight (Sun)
| Time | Who | What |
|---|---|---|
| Now | Orchestrator | Register on Devpost; open Main Codex Session; paste PROJECT.md + this doc as the opening brief; set OpenAI usage cap (C-EC7); verify GPT-5.6 API access (C-EC8) |
| +0–1 h | C | C-1 scaffold + deploy hello-world |
| Parallel | D | D-1 recordings (start immediately — kids sleep early), D-2 passages |
| +1–2 h | A | **A-1 risk spike** on D's first real recording |
| +2 h | — | **GATE 1 — GO/PIVOT:** child audio transcribes usably? GO → continue. Marginal → English-only, older kids, re-test. Fails outright → orchestrator decision tonight: fall back to the adult-voice + "simulated reader" framing or to the handwriting-grading concept (last resort; costs the niche) |
| +2–4 h | C, then A | C-2 seed, C-3 storage → A-2, A-3 |

### Day 1 (Mon)
| Time | Who | What |
|---|---|---|
| 09:00–13:00 | A | A-4 guard, A-5 analyze, A-6 golden harness |
| 13:00 | — | **GATE 2 — walking skeleton:** golden file → deployed URL → JSON analysis visible (ugly is fine) |
| 13:00–18:00 | B | B-1 record screen, B-2 confirm screen (on mock) |
| 18:00–19:00 | B+A | **GATE 3 — the swap:** B replaces mock import with live pipeline; run golden files through real UI |
| 19:00–22:00 | B / C | B-3 heatmap · C-4 worksheets |
| 22:00 | D | First stranger-ish test on live URL; bug list to orchestrator |

### Day 2 (Tue)
| Time | Who | What |
|---|---|---|
| 09:00–12:00 | B, C | B-4 sample button, B-5 error states · C-5 print, C-6 reset-demo · **D-11 Devpost form dry-run** |
| 12:00–14:00 | A | Hardening ONLY: golden re-runs, prompt tuning, retries. **GATE 4 — FEATURE FREEZE at 14:00.** Nothing new merges after this |
| 14:00–15:00 | C | `reset-demo`; deploy final; incognito checks (C-EC3) |
| 15:00–16:00 | D + all | Stranger tests ×2; only freeze-exempt fixes: crashes, dead ends |
| 16:00–19:00 | D | Video shoot vs live URL (golden recordings only), edit, **upload YouTube by 18:00** |
| 19:00–20:00 | Orch. | `/feedback` in Main Session → Session ID captured; README final read |
| 20:00–23:00 | D | Fill Devpost form, attach everything, **GATE 5 — SUBMIT**, screenshot confirmation |
| 23:00–23:59 | — | Buffer. If unused, sleep. |

**Pre-agreed cut order (orchestrator invokes, no debate):** 1) Hindi UI (keep one Hindi golden clip if passing) → 2) parent voice note → 3) worksheet levels beyond one per group → 4) heatmap trend arrows. **Never cut:** confirm screen, heatmap, sample-recording button, deployed demo, video, README, Session ID.

---

## 7. CROSS-CUTTING HACKATHON EDGE CASES (owner: orchestrator)
| # | Case | Handling |
|---|---|---|
| X-1 | `/feedback` ID must cover "majority of core functionality" | The hub-and-spoke model (§0) exists for exactly this; all A/B/C code lives in the Main Session |
| X-2 | Free Codex credits closed Jul 17 | Use ChatGPT-plan Codex + own API key with hard cap; note actual API spend in README (judges like cost realism) |
| X-3 | Rules page details (IP, team size) not re-verified | Read https://openai.devpost.com/rules fully tonight — 10 minutes, prevents disqualification-class surprises |
| X-4 | Multiple submissions / wrong track | One submission, track = Education, confirmed on the preview screen |
| X-5 | Demo URL down during judging window | Vercel free tier is reliable; pin the deployment (no auto-deploys after submit); repo README includes video + screenshots as fallback evidence |
| X-6 | Claims about children's data | README privacy note: recordings are consented samples; app stores audio in a demo bucket; production would require guardian consent + retention policy (named as next-step work) |

---

## 8. FINAL PRE-SUBMIT CHECKLIST (print this)
- [ ] Live URL: stranger test passes end-to-end, incognito
- [ ] "Load sample recording" works with mic denied
- [ ] Golden harness table in README; sample audio in `sample-data/`
- [ ] README: quickstart timed < 10 min on fresh clone; Codex/GPT-5.6 decisions section present; limitations honest
- [ ] Repo public + MIT (or shared with both judge emails)
- [ ] Video ≤ 3:00, public YouTube, plays logged-out, audio explains Codex AND GPT-5.6 usage
- [ ] `/feedback` Session ID captured from Main Session and entered in form
- [ ] Track = Education; all team members on Devpost
- [ ] Submitted ≤ Tue 11:59 PM IST; confirmation screenshot saved
- [ ] `reset-demo` run; deployment pinned

*Plan complete. The thinking is done — from here, every hour is execution.*
