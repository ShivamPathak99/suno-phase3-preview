# Suno — UI Design Specification
### For Codex: implement exactly; every hex, size, and word here is a decision, not a suggestion.

> Fourth doc in the set. PROJECT.md = what · AGENT_EXECUTION_PLAN.md = who/when · CODEX_WORKFLOW.md = how to drive · **this doc = what it looks like.**
> Agent B implements screens from this spec; Agent C implements tokens (§2) and print (§8).

---

## 1. DESIGN DIRECTION

**The product is a teacher's professional instrument, drawn from the classroom's own material world.** Three artifacts every Indian primary teacher touches daily give us the entire visual language:

1. **The ruled notebook page** — reading passages sit on subtle four-line English ruling / do-lakeer-style ruling, like a page from an exercise book.
2. **The teacher's red pen** — the signature element (§5): AI-detected reading errors render as pen markings a teacher already knows how to read — strikethrough for skipped, wavy underline for substituted, dotted underline for hesitation. Not tech-style highlight pills; marking language.
3. **The ASER level ladder** — letter → word → paragraph → story appears as a consistent 4-step motif on the dashboard, the level result card, and worksheet headers.

**Register:** calm, warm, competent. A tool, not a toy — no cartoons, no mascots, no emoji, no gradients, no glassmorphism, no dark mode (paper doesn't have one; out of scope for 2 days). The warmth comes from paper tones, rounded type, and generous spacing — never from decoration.

**One aesthetic risk, spent in one place:** the pen-marked passage. Everything else stays disciplined.

---

## 2. DESIGN TOKENS (Agent C: put in `tailwind.config` + CSS vars)

### 2.1 Color — named palette
| Token | Hex | Use |
|---|---|---|
| `paper` | `#FAF9F4` | Page background everywhere |
| `card` | `#FFFFFF` | Cards, sheets |
| `ink` | `#1E2B33` | Primary text (blue-black ink) |
| `slate` | `#5C6B73` | Secondary text, captions |
| `ruling` | `#C9D8E4` | Notebook ruling lines, hairline borders |
| `board` | `#146152` | THE accent (classroom-board green): primary buttons, active states, links, focus |
| `board-dark` | `#0E4A3F` | Button hover/pressed |
| `pen` | `#D64545` | Teacher's-pen error markings ONLY (never buttons, never level identity) |

### 2.2 Level colors (semantics frozen in the plan — hexes finalized here)
| Level | Core | Tint (bg) | Icon (secondary cue — never color alone) |
|---|---|---|---|
| `letter` | `#C4453C` | `#FBEAE8` | single glyph "A / अ" |
| `word` | `#B26A00` | `#FBF1DE` | short single line |
| `paragraph` | `#1D6FB8` | `#E8F1FA` | three stacked lines |
| `story` | `#1F7A3D` | `#E7F4EB` | small open-book outline |

Text on a tint always uses that level's core color. Level red (`#C4453C`) vs pen red (`#D64545`): levels appear only as tinted chips/columns WITH icon+label; pen red appears only as markings on the passage — contexts never mix, plus the icon requirement removes ambiguity.

### 2.3 Type (3 faces, all on Google Fonts)
| Role | Face | Why | Usage |
|---|---|---|---|
| Display | **Baloo 2** (600) | Indian foundry (Ek Type), rounded warmth, native Devanagari | Screen titles, level names, big numbers ONLY — restraint |
| UI / body | **Noto Sans** + **Noto Sans Devanagari** (400/600) | Complete Hindi coverage, quiet legibility | Everything else; numbers use `font-variant-numeric: tabular-nums` |
| Passage | **Andika** (400) | Designed by SIL specifically for beginning readers | The child-facing reading text (EN); HI passages use Noto Sans Devanagari at passage scale |

Scale: display 28/34 · title 22/28 · body 16/24 · caption 13/18 · **passage 26/44 (mobile) → 32/56 (≥768px)** — the passage is the largest text in the app because a 6-year-old reads it at arm's length.

### 2.4 Space, shape, elevation
4px base grid · card radius 12px · button/input radius 10px · **minimum tap target 48×48px everywhere** (phone passes between adult and child) · borders 1px `ruling`; elevation = border + `0 1px 2px rgba(30,43,51,.06)` max — paper sits flat.

### 2.5 Motion (one orchestrated moment)
Default: 150ms ease-out on interactive states only. **The moment:** after Confirm, navigate to dashboard where the student's card glides into its level column (300ms translate+fade) with a brief tint pulse on the column header. Recording state: soft 1s opacity pulse on the red dot. Everything wrapped in `prefers-reduced-motion` guards. Nothing else animates.

---

## 3. SCREEN 1 — DASHBOARD `/`

Job: one glance = the class's reading reality; one tap = start assessing.

```
DESKTOP (≥1024)                             MOBILE (360)
┌──────────────────────────────────────┐    ┌──────────────────┐
│ Suno   Class 3 · 32 children  [Assess]│    │ Suno    [Assess] │
│ ── level ladder strip ──              │    │ Class 3 · 32     │
│  A 9   ─ 12   ≡ 8   📖 3   (counts)   │    │ ladder strip     │
├────────┬────────┬────────┬───────────┤    ├──────────────────┤
│ LETTER │ WORD   │ PARA   │ STORY     │    │ ▾ LETTER (9)     │
│ tinted │ tinted │ tinted │ tinted    │    │  [card][card]…   │
│ header │ header │ header │ header    │    │ ▾ WORD (12)      │
│ [card] │ [card] │ [card] │ [card]    │    │  [card][card]…   │
│ [card] │ [card] │ [card] │           │    │ …                │
├────────┴────────┴────────┴───────────┤    ├──────────────────┤
│ Suggested groups ▸ 3 groups [Print]  │    │ Groups panel     │
└──────────────────────────────────────┘    └──────────────────┘
```

- **Ladder strip:** four level chips (tint + icon + count) in ASER order; the app's recurring motif.
- **Columns:** header = level tint bar with icon + name (Baloo 2) + count; column body `paper`, cards `card`.
- **Student card (the atom):** 1 line name (truncate >18 chars, full name on assess screen) · caption "Assessed 3 days ago · 2nd time" · right edge: 44px `Assess` icon-button (board green). Whole card min-height 64px. Unassessed students live in a fifth muted "Not yet assessed" group ABOVE the columns, never faked into a level.
- **Groups panel:** cards "Group 1 · Word level · 12 children — [Print reading cards]".
- Mobile: columns become stacked sections in ladder order, all expanded (no hidden content), 2-up card grid.

Empty column state: ghost card, caption "No children at this level yet." Empty class (fresh install): full-bleed invitation — title "Listen to your first reader", body one sentence, single `Assess a child` button.

---

## 4. SCREEN 2 — ASSESS FLOW `/assess/[id]` (states A→B→C)

Job: hand the phone over; get out of the child's way.

**State A — Ready.** Header: child's full name + passage level chip. The passage on a **ruled card**: `card` bg, horizontal 1px `ruling` lines every 44px (behind text via CSS `repeating-linear-gradient`, aligned to the passage line-height so text sits ON the lines like a notebook), generous 24px padding, Andika at passage scale. Below, centered: **Record button — 88px circle, board green, mic glyph**, caption "Hand the phone to {first name}, then tap". Secondary, quiet text-button underneath: `No mic? Use a sample recording` (B-4 — always visible, judges rely on it). Tertiary link: "Change passage".

**State B — Recording.** Passage stays fully visible (child is reading it!). Record button becomes 88px `pen`-red stop button with white square; above it a 5-bar amplitude indicator + mm:ss timer (tabular nums). Auto-stop at 2:00 with a gentle notice. Accidental-tap guard: stopping under 5s asks "Keep or discard this recording?"

**State C — Processing.** Passage dims to 40%; centered card with a three-step checklist that ticks through: `Uploading the recording ✓` → `Listening to the reading ✓` → `Checking each word…` (spinner on active row). Each step has its own 45s timeout → error state (§7). These three lines are the demo-video moment where the pipeline narrates itself — do not replace with a generic spinner.

---

## 5. SCREEN 3 — CONFIRM (THE HERO — highest polish budget in the app)

Job: teacher verifies the AI in under 30 seconds and stays in charge.

```
MOBILE (primary)                       DESKTOP: passage left (60%),
┌──────────────────────┐               result rail right (40%), sticky.
│ ← Ravi · attempt 2   │
│ ┌──── ruled card ───┐│
│ │ The cat s̶a̶t̶ on the ││   ← pen markings on the passage
│ │ ~~~~~                │
│ │ brown mat …        ││
│ └───────────────────┘│
│ marks legend (1 line)│
│ ┌ level card ───────┐│
│ │ ▮ WORD level      ││   ← level tint + icon + Baloo 2 name
│ │ 21 wcpm · 68% acc ││
│ └───────────────────┘│
│ "Ravi reads common   │
│  words confidently…" │   ← summary_for_teacher, quoted style
│ [ Confirm level ✓ ]  │   ← full-width board-green, 56px
│  Re-record · quiet   │
└──────────────────────┘
```

**Pen-marking language (the signature — implement precisely):**
| status | rendering on the passage |
|---|---|
| `correct` | plain ink, untouched |
| `skipped` | `pen` strikethrough, slight -1° skew (SVG line or text-decoration + transform) |
| `substituted` | `pen` wavy underline (`text-decoration: underline wavy`); tapping shows "heard: 'sit'" |
| `hesitation` | `pen` dotted underline |
| `unclear` | slate dashed underline + 12px "?" superscript in `pen` |
| low `confidence` | 3px `pen` dot above the word — "check me" cue |

One-line legend below the card, caption size, always visible (judges have never seen the app; teachers stop needing it after day one).

**Tap-a-word → bottom sheet** (240ms slide-up, desktop: popover): word large in Andika · rows (48px each): `Mark as read correctly` / `Mark as skipped` / `Heard as… [text input]` / `Cancel`. Overridden words get a small board-green corner tick. Level/WCPM recompute **server-side on Confirm** (frozen decision B-EC7) — sheet closes optimistically, numbers update on response.

**Confirm** button disables on first tap (double-submit guard) → success toast "Ravi confirmed at word level" → dashboard slot-in moment (§2.5). `Re-record` is a quiet text button — present, never competing.

---

## 6. SCREEN 4 — WORKSHEET `/worksheet/[level]` (print-first)

Screen chrome: level ladder header with current level highlighted, `Print reading cards` primary button, `Regenerate` quiet button. **The artifact is the A4 page:**

- Header row: "Reading practice · Word level" (Baloo 2) + level icon; right-aligned blank lines `Name ______  Date ______` (teachers photocopy these).
- Body: passage in Andika 22pt equivalent, 1.8 line-height, on printed ruling (light gray lines — must survive grayscale photocopying; test at 60% gray).
- Footer: one comprehension question + two ruled answer lines; bottom-right corner: "Suno · suno.app" caption.
- `@media print`: hide all chrome/nav/buttons; margins 18mm; **no `position: fixed`** (Chrome print-blank trap, edge case C-EC10); black text on white — ruling at `#BBBBBB`.

---

## 7. STATES, ERRORS, COPY (copy is design material — use these words)

Voice: plain verbs, sentence case, direct, never apologetic, always says what to do next. Buttons say what happens: `Start reading`, `Confirm level`, `Print reading cards` — and keep their names through the flow (Confirm → toast "Confirmed").

| Situation | Title | Body | Action |
|---|---|---|---|
| Mic permission denied | Microphone is blocked | Allow the microphone in your browser's address bar, or use a sample recording. | `Try again` · `Use a sample` |
| Too short / silent (A-EC1/2) | Couldn't hear the reading | The recording was too quiet or too short. Move closer to {name} and try again. | `Record again` |
| Wrong passage (A-EC4) | That didn't match the passage | The reading didn't match the text on screen. Check the passage and try again. | `Record again` · `Change passage` |
| Upload failed | The recording didn't upload | Check the connection. The recording is saved — you won't need to record again. | `Retry upload` |
| Analysis timeout | This is taking too long | Something's stuck on our side. Try once more. | `Retry` |
| Empty student (no assessments) | Not assessed yet | — | `Assess now` |

Loading is always the 3-step checklist (§4C), never an unexplained spinner. Toasts: bottom, 3s, one at a time.

---

## 8. QUALITY FLOOR (built in, not announced)

Responsive 360→1440 with the two layouts specced above · every interactive element has a visible 2px `board` focus ring (`:focus-visible`) · contrast: all token pairs above pass 4.5:1 (word-amber `#B26A00` on white = 4.6:1 — do not lighten it) · status never encoded by color alone (marks + icons carry it) · `prefers-reduced-motion` kills the slot-in and pulses · `lang="hi"` on Hindi passage nodes so Devanagari shaping/screen-readers behave · all images/icons are inline SVG (no icon-font flash on slow school connections).

## 9. ANTI-GOALS (Codex: refuse these even if momentum suggests them)
No dark mode · no gradients, glass, shadows beyond §2.4 · no emoji in UI · no mascots/cartoons/clipart · no purple-SaaS defaults · no skeleton-shimmer libraries (use the checklist loader) · no component library (shadcn/MUI) — hand-rolled Tailwind against these tokens is smaller, faster, and on-direction.

## 10. BUILD ORDER FOR AGENT B (unchanged tickets, now with this spec)
B-1 assess states A/B/C → B-2 confirm screen (§5, budget double) → B-3 dashboard (§3) → B-4 sample-recording path → B-5 error states (§7 copy verbatim). Definition of visually-done per screen: side-by-side with this doc, every token, size, and string matches.
