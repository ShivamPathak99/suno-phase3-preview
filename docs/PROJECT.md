# Suno — The ASER Machine

> Working name: **Suno** (Hindi: "listen"). Verify name availability before printing it on the video; fallbacks: *SunoShala*, *PadhLevel*, *KakshaAI*.

**One-liner:** A child reads aloud to a phone; AI levels them in 90 seconds, groups the class by reading level, and prints right-level material — automating the assessment bottleneck inside India's most proven literacy intervention.

**Devpost pitch (198 chars):**
> 76% of India's Class 3 kids can't read a Class 2 text. A child reads aloud to a phone; AI levels them in 90 seconds, groups the class, and prints right-level material. The proven fix, unbottlenecked.

**Hackathon:** OpenAI Build Week (openai.devpost.com) · Track: **Education** · Deadline: **Tue, Jul 21, 5:00 PM PDT = Wed, Jul 22, 5:30 AM IST** (personal deadline: Tue 11:59 PM IST)

---

# PART 1 — PRODUCT

## 1.1 The problem

India's foundational literacy crisis is quantified by ASER (Annual Status of Education Report), Pratham's citizen-led survey running since 2005: **76% of Class 3 children in rural India cannot read a Class 2-level text** (ASER 2024). Children sit in classrooms being taught from textbooks two to three grades above their actual reading level, and the gap compounds every year.

The fix is known. **Teaching at the Right Level (TaRL)** — developed by Pratham, validated across multiple J-PAL randomized controlled trials — is among the most cost-effective education interventions ever rigorously studied. The method: assess every child orally, group by *level* (not grade), teach each group at its level, re-assess every few weeks, re-group.

The bottleneck is the assessment. Leveling one child means listening to them read aloud, one-on-one, for 8–10 minutes — a teacher with 40–50 students (India's senior-secondary pupil–teacher ratio is 47:1) loses a full week of instruction per assessment round, several times a year. ASER itself requires 25,000+ trained volunteers to run the test once annually on a *sample* of children. Because the diagnostic is manual, slow, and endlessly repeated, groupings go stale, teachers skip rounds, and TaRL fails to scale despite being proven.

**One sentence: the cure exists, but the thermometer is too expensive to use. We automate the thermometer.**

## 1.2 Evidence base (cite these everywhere — README, video, Devpost)

| Claim | Source |
|---|---|
| 76% of Class 3 can't read Class 2 text; 89% of rural 14–16-year-olds have smartphone access | ASER 2024 (Pratham) |
| TaRL is among the most cost-effective literacy interventions ever tested | J-PAL RCTs / Pratham |
| AI tutoring in low-resource settings: ~0.3 SD gain (≈ 2 years of learning) in 6 weeks at ~$48/student, beating 80% of studied interventions | World Bank Nigeria RCT (2025) |
| Unrestricted chatbot access made students score 17% *worse* on exams; guardrailed AI erased the harm → AI must live inside pedagogy, with the teacher in control | PNAS study, ~1,000 Turkish high-schoolers |
| Teachers adopt AI at scale when it fits workflow; weekly AI-using teachers save ~5.9 hrs/week | Gallup 2025 / MagicSchool (5M+ educators) |
| AI judgment alone can't be trusted for assessment → teacher-confirm design | AI grading accuracy studies (rubric-dependence) |

## 1.3 Users

- **Primary: the early-grade teacher** (government/low-cost private school, Classes 1–5, India and the Global South). Owns a smartphone; classroom runs on paper and a printer at best. Buys nothing; adopts what saves hours.
- **Secondary: the child** (ages 5–10) — interacts for 90 seconds: reads a passage off the phone.
- **Tertiary: the parent** — often a first-generation-learner household; receives an optional voice note in their own language.
- **Future buyer: NGOs / TaRL programs / state education departments** — post-hackathon path, not needed for the demo.

## 1.4 The product — four modules, one loop

1. **Listen.** Teacher opens the app, hands the phone to a child. A leveled passage (Hindi or English) displays; the child reads aloud; the phone records.
2. **Confirm.** AI transcribes with word timestamps and aligns the transcript against the passage: accuracy, words-correct-per-minute (WCPM), error taxonomy (skipped / substituted / hesitation), and an ASER-style level — *letter → word → paragraph → story*. The teacher sees the passage with errors highlighted and per-word confidence, taps to fix mishears, and confirms. **90 seconds vs 10 minutes; the teacher, not the AI, has the final word.**
3. **Group.** The class renders as a heatmap by reading level with suggested TaRL groups. Invisible data becomes visible: "12 story-level, 19 word-level, 9 still at letters."
4. **Teach.** One tap per group generates a level-matched, printable reading card. Optional: a voice note per child for the parent, in the parent's language.

Then the loop repeats — re-assess in 3 weeks, watch the heatmap shift, re-group.

## 1.5 Differentiation ("why not free ChatGPT?")

- ChatGPT cannot sit inside a classroom workflow: 50 children, one phone, paper worksheets, a syllabus, a teacher accountable for groupings.
- The value is not the chat — it's **structured oral assessment + class-level analytics + teacher control**, none of which a general chatbot provides.
- The evidence says unguided AI *harms* learning (PNAS −17%); our design is the guardrailed, teacher-in-the-loop version the research validates.
- Competitive landscape: US teacher tools (MagicSchool) are text-based, English, US-standards; edtech tutors target students who can already read. **Voice + early-primary + Indian languages + ASER methodology is an empty lane.**

## 1.6 Hackathon strategy

**Judging criteria mapping:**
- *Technological implementation* — multi-stage pipeline (audio → timestamped ASR → GPT-5.6 structured alignment → analytics → generation) built in one Codex session; README narrates where Codex made key decisions.
- *Design* — one persona, one linear flow, three screens; judges can test with their own voice in 30 seconds; seeded demo classroom so no empty states.
- *Potential impact* — the demo *is* the impact mechanism (90-second leveling × 250M schoolchildren × 3 rounds/year); every claim carries a citation; no overclaiming (validation study named as next step).
- *Quality of idea* — near-zero collision with 38,000 participants; framing line: **"Everyone built for students who can already read. We built for the 76% who can't."**

**Submission requirements checklist (from openai.devpost.com):**
- [ ] Working project built with Codex using GPT-5.6, Education track
- [ ] Project description (what + how)
- [ ] Demo video < 3 min, public YouTube, audio explains how Codex AND GPT-5.6 were used
- [ ] Repo URL — public with MIT license (or private, shared with testing@devpost.com and build-week-event@openai.com)
- [ ] README: setup instructions, **sample data (audio files)**, run guidance, and an explicit "how Codex accelerated the build / key decisions / how GPT-5.6 was used" section
- [ ] `/feedback` Codex Session ID from the **one main session** where the majority of core functionality was built → into the submission form
- [ ] Submitted by Tue 11:59 PM IST (buffer before the real deadline)

**Video cold open (first 15 s):** black screen → *"In rural India, 76% of Class 3 children cannot read a Class 2 sentence."* → one teacher, packed classroom: *"The fix has been proven for twenty years... but testing one child takes ten minutes. She has fifty."* → child's real voice reading haltingly on the phone → *"So we taught the phone to listen."* → level appears: "Word level — 90 seconds" → title card → demo. Close (last 30 s): Codex session footage + GPT-5.6 usage narration + Nigeria/$48 impact math.

## 1.7 Post-hackathon roadmap (mention in README as "next steps"; do not build)

1. Validation study: agreement rate between app levels and trained ASER assessors.
2. Hindi-first expansion → regional languages; *matra*-level error taxonomy.
3. Parent voice notes at scale; WhatsApp delivery.
4. Pilot with a TaRL-practicing NGO / state FLN (NIPUN Bharat) program.
5. Numeracy module (ASER arithmetic ladder) — same architecture, new instrument.

---

# PART 2 — TECH

## 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router) + TypeScript** | Frontend + API in one repo/deploy; Codex's strongest stack |
| Hosting | **Vercel** | One-command deploy; judge-clickable URL |
| DB + file storage | **Supabase** (Postgres + Storage, free tier) | One service for rows and audio; `supabase-js`, no ORM |
| Styling | **Tailwind CSS** | Speed |
| Speech→text | **OpenAI transcription endpoint, word-level timestamps** | Feeds the alignment step |
| Intelligence | **GPT-5.6 with structured outputs (strict JSON schema)** | Alignment/analysis, worksheet generation, parent note |
| Voice note (Tier 3) | OpenAI TTS | One API call |
| Auth | **None** | Single seeded demo classroom; zero judge friction |

## 2.2 Architecture

```
┌────────────────────────────┐
│  Teacher web app (browser) │  mic capture · confirm UI · heatmap · print
└─────────────┬──────────────┘
              │ 3 short client-orchestrated calls
┌─────────────▼──────────────┐
│  Next.js API routes        │  Vercel serverless (each call < 15 s)
└──┬──────────┬──────────┬───┘
   │          │          │
┌──▼───────┐ ┌▼────────┐ ┌▼──────────────┐
│Transcribe│ │ GPT-5.6 │ │ Supabase      │
│(word ts) │ │analysis+│ │ Postgres +    │
│          │ │generate │ │ audio storage │
└──────────┘ └─────────┘ └───────────────┘
```

**Key decision — client-orchestrated pipeline.** One monolithic `/api/assess` call (upload + transcribe + analyze) would run 15–30 s, risk serverless timeouts, and show a dead spinner. Instead the browser drives three short calls with staged progress UI ("Uploading…" → "Listening…" → "Checking each word…"). Each call stays under timeout; the demo narrates itself.

## 2.3 Data model (freeze at Hour 0; never migrate again)

```sql
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  avatar_seed text,
  is_demo boolean default false
);

create table passages (
  id uuid primary key default gen_random_uuid(),
  level text check (level in ('letter','word','paragraph','story')),
  language text check (language in ('en','hi')),
  title text,
  body text not null
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  passage_id uuid references passages(id),
  audio_url text,
  transcript_json jsonb,     -- raw timestamped transcript
  analysis_json jsonb,       -- full GPT-5.6 output (schema §2.6)
  level text,
  wcpm numeric,
  accuracy numeric,
  teacher_confirmed boolean default false,
  created_at timestamptz default now()
);

create table worksheets (
  id uuid primary key default gen_random_uuid(),
  level text,
  language text,
  content_json jsonb,
  created_at timestamptz default now()
);
```

JSON blobs (`analysis_json`, `content_json`) are deliberate: schema churn is the #1 time sink in AI-assisted builds; blobs let the analysis shape evolve without migrations. Seed script: 8 passages (4 levels × EN/HI) + **20 demo students with pre-baked plausible assessments** so the dashboard is never empty.

## 2.4 API surface (frozen contracts)

| Route | In | Out |
|---|---|---|
| `POST /api/upload-url` | `{ fileName, contentType }` | `{ audioUrl, contentType, path, signedUrl }`; browser PUTs the blob directly to the signed Supabase URL |
| `POST /api/transcribe` | `{ audioUrl }` | success: `{ words: [{word, start, end}], text, durationSec }`; guard: `{ unassessable: true, reason }` |
| `POST /api/analyze` | `{ studentId, passageId, audioUrl, transcript }` | `{ assessmentId, analysis }`; `analysis` is exactly §2.6 and is saved as an unconfirmed draft |
| `POST /api/assessments/[assessmentId]/confirm` | `{ overrides: [...] }` | confirmed assessment; server recomputes level after overrides |
| `POST /api/worksheets` | `{ level, language }` | worksheet content JSON |

Notes: `assessmentId` is the stable UI handoff from draft analysis to teacher confirmation; it is never added to the frozen §2.6 analysis object. Analyze may also return `{ unassessable: true, reason }` when its guard rejects the transcript or detects a different passage. `OPENAI_API_KEY` stays server-side only; MediaRecorder produces `webm/opus` on Chrome and `mp4/aac` on iOS Safari — accept both (demo on Chrome).

## 2.5 Screens (three, one job each)

1. **`/` Dashboard** — heatmap: student cards in four level columns (level colors consistent app-wide), suggested TaRL groups (pure function over levels, no AI call), per-student "Assess" button.
2. **`/assess/[studentId]` — the hero flow** — passage displayed large → big record button → staged progress → **Confirm screen**: passage with word-by-word color coding (green correct · red substituted · amber hesitation · strikethrough skipped), low-confidence words flagged, tap-to-override, confirm action, level result. *Highest-polish screen in the app.* Include a **"Load sample recording" button** — judges' zero-friction path and your demo safety net.
3. **`/worksheet/[level]`** — generated reading card, `@media print` CSS → clean A4 on Ctrl+P. No PDF library.

**Design direction:** a teacher's professional tool, not a kids' app — calm, generous type, one accent color, four consistent level colors, big tap targets (phone passed between adult and child). Error paths handled visibly: mic permission denied; unintelligible audio → "Couldn't assess — try again closer to the child."

## 2.6 The core prompt + schema (`/api/analyze`)

**System prompt:**

```
You are an oral reading fluency assessor for early-grade children in India,
following ASER methodology. You receive: (1) the passage text the child was
shown, (2) a word-timestamped transcript of the child reading aloud.
Align the transcript against the passage word-by-word. Children may skip
words, substitute similar-looking words, self-correct, repeat, or pause.
A gap >3s before a word = hesitation. Ignore filler sounds and self-corrections
that end correct. Be generous on accent and pronunciation variants — score
decoding, not accent. Classify overall level per ASER: "letter" | "word" |
"paragraph" | "story". Return ONLY the JSON schema provided.
```

**Structured output schema (strict mode):**

```json
{
  "level": "letter | word | paragraph | story",
  "wcpm": "number",
  "accuracy_pct": "number",
  "words": [{
    "passage_word": "string",
    "status": "correct | substituted | skipped | hesitation | unclear",
    "heard_as": "string | null",
    "confidence": "high | medium | low"
  }],
  "summary_for_teacher": "string, 2 plain-language sentences",
  "recommended_focus": "string, one skill to practice"
}
```

The `words` array drives the confirm screen; `confidence` drives visual flags — the ASR-imperfection insurance, rendered as UI.

**Worksheet prompt (sketch):** "Generate a reading practice card for a child at {level} level in {language}, Indian primary-school context, ~{n} words, familiar vocabulary, one short comprehension question. Return JSON: {title, body, question}."

## 2.7 Build workflow (workstreams, order, done-criteria)

**Operating principle: walking skeleton first.** By end of tonight, hardcoded passage + uploaded audio file → JSON analysis on screen. Everything after upgrades a working system.

**Hour 0 — freeze the three contracts:** analysis schema (§2.6), DB schema (§2.3), API surface (§2.4). All modules then build independently against them.

| WS | Ticket | Done when | When |
|---|---|---|---|
| **WS0 Foundation** | T0.1 Scaffold (Next+TS+Tailwind+supabase-js, MIT) | "Hello world" **deployed on Vercel** | Tonight |
| | T0.2 Migration + seed (8 passages, 20 demo students) | One command → populated dashboard data | Tonight |
| | T0.3 **Risk spike**: real child recording → transcription API → sane timestamped words | Script output verified | **Tonight, first** |
| **WS1 Pipeline** | T1.1–1.3 upload / transcribe / analyze routes | All callable via curl with a sample file, no UI | Day 1 AM |
| | T1.4 Golden-set harness (3–4 real recordings → side-by-side results) | Re-runnable on every prompt change | Day 1 AM |
| **WS2 Hero UI** | T2.1 Record screen + staged progress | Live audio flows end-to-end | Day 1 PM |
| | T2.2 **Confirm screen** (color-coded words, tap-fix, confidence) | Polished; budget double | Day 1 PM |
| | T2.3 Error paths (mic denied, unintelligible) | Graceful messages | Day 1 PM |
| **WS3 Classroom** | T3.1 Heatmap + T3.2 group suggestions | New assessment slots into seeded board | Day 2 AM |
| **WS4 Content** | T4.1 Worksheet gen + T4.2 print CSS | Ctrl+P → clean A4 | Day 2 midday |
| **WS5 Submission** (protected 4 h) | T5.1 README (+ Codex narrative, sample audio) · T5.2 `/feedback` session ID · T5.3 video vs live URL · T5.4 Devpost form | Submitted Tue 11:59 PM IST | Day 2 PM |

**Dependency spine:** T0.3 gates everything → WS1 gates T2.2 → all else hangs off the frozen contracts.

**Pre-agreed cut order (cut top-down under time pressure):** 1) Hindi (keep one Hindi sample if it works) → 2) parent voice note → 3) worksheet variants (one level set) → 4) group-suggestion polish. **Never cut:** confirm screen, heatmap, deployed demo, video.

**Risk register:**
- *R1 Child-ASR quality* (high impact): T0.3 tonight; per-word confidence; teacher override; verified demo recordings. Fallback: narrow claim to clearer readers — an honest narrow demo beats a broad flaky one.
- *R2 Demo flakiness*: video only against pre-verified recordings; "Load sample recording" button.
- *R3 Scope creep* (certain): the cut order above is the pre-made decision.
- *R4 Submission mechanics* (fatal if hit): WS5 block is untouchable; a broken repo link scores zero.

## 2.8 Deployment & environment

```
# .env.local
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only (seed + storage writes)
```

1. Supabase project → run migration + seed → create public `audio` storage bucket.
2. Vercel → import repo → set env vars → deploy. Deploy **tonight** (T0.1), then on every merge; the deployed URL is the only truth.
3. Set route `maxDuration` ≈ 60 s as belt-and-braces (the 3-call design should keep each far below).
4. Repo includes `/sample-data/` with the child recordings (required "sample data") + a `README` quickstart: clone → env → `npm run seed` → `npm run dev`.

## 2.9 Codex working agreement

- **One main Codex session** for all core functionality (pipeline + screens) — this session's `/feedback` ID goes in the submission. Side sessions only for throwaway experiments.
- Opening message of the session = **this entire document**, followed by: "Scaffold the repo and build in this order: T0.1 → T0.2 → T1.1–1.4 → T2.1–2.3 → T3 → T4. Honor the frozen contracts exactly. Ask before deviating from the schema or API surface."
- While building, log 3–4 concrete "Codex decided/accelerated X" moments into the README the same day (e.g., alignment edge-case handling, MediaRecorder format branching, print CSS) — judges explicitly score this narrative.

## 2.10 Definition of done (the stranger test)

A stranger opens the URL → sees a full classroom → records themselves reading badly → watches their skipped/substituted words get caught → fixes one word → confirms → appears on the heatmap → prints a worksheet — **without asking you anything.** Run this on a real friend Tuesday afternoon before recording the video.
