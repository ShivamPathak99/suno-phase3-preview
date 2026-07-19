# Suno — Codex Operating Procedure (Flow Edition)
### How to run the entire 2-day build through Codex, step by step

> Third document in the set. `PROJECT.md` = what we're building. `AGENT_EXECUTION_PLAN.md` = who builds what, when, with which edge cases. **This doc = how you personally drive Codex, hour by hour, as a flow.**
> All flow graphs are Mermaid — they render on GitHub. Keep this file in the repo so Codex can read it too.

**The one rule above all rules:** you supply *sequence, verification, and judgment*; Codex supplies *code*. Result quality tracks how strictly these roles stay separated.

---

## 0. THE MASTER FLOW (the whole 2 days on one graph)

```mermaid
flowchart TD
    S0["STEP 0 · Human setup (30 min)\nrepo + docs · API key + cap\nVercel/Supabase · start kid recordings"] --> S1
    S1["STEP 1 · Boot Main Session\nalignment check, no code yet"] --> S1V{Codex restates plan\ncorrectly?}
    S1V -- no --> S1F["Correct misunderstandings\nre-ask for restatement"] --> S1V
    S1V -- yes --> A1["TICKET A-1 · Risk spike\nreal child audio → transcription"]
    A1 --> G1{GATE 1\nGO / MARGINAL / FAIL}
    G1 -- GO --> LOOP
    G1 -- MARGINAL --> M1["Narrow scope:\nEnglish-only · older kids\nre-run spike"] --> G1
    G1 -- FAIL --> P1["PIVOT tonight (orchestrator):\nadult-voice framing, or\nfallback concept"] --> LOOP
    LOOP["THE TICKET LOOP (§2)\nrepeated ~20×:\nC-1→C-2→C-3→A-2…A-6→\nB-1…B-5→C-4…C-6"] --> G2{GATE 2 · Day 1, 13:00\nwalking skeleton on live URL?}
    G2 -- no --> FIX2["Fix pipeline before ANY UI work"] --> G2
    G2 -- yes --> LOOP2["Continue loop: B tickets on MOCK"]
    LOOP2 --> G3{GATE 3 · Day 1, 18:00\nmock → live swap clean?}
    G3 -- no --> FIX3["Schema drift hunt:\ndiff real output vs mock_analysis.json"] --> G3
    G3 -- yes --> LOOP3["Day 2 AM: B-4, B-5, C-5, C-6\n+ A hardening only"]
    LOOP3 --> G4["GATE 4 · Day 2, 14:00\nFEATURE FREEZE\n(tell Codex to refuse new features)"]
    G4 --> END["STEP 6 · Endgame flow (§7):\nreset-demo → stranger tests →\nvideo → /feedback ID → SUBMIT"]
    END --> G5["GATE 5 · Tue ≤ 23:59 IST\nsubmitted + screenshot"]
```

---

## 1. STEP 0 — BEFORE OPENING CODEX (human-only, 30 min)

```mermaid
flowchart LR
    A["Create GitHub repo 'suno'"] --> B["Commit PROJECT.md +\nAGENT_EXECUTION_PLAN.md +\nthis file + empty sample-data/"]
    B --> C["OpenAI dashboard:\nAPI key · hard cap ~$25 ·\nverify GPT-5.6 access"]
    C --> D["Vercel + Supabase accounts\nconnect repo to Vercel"]
    D --> E["Launch Agent D physical task:\nchild recordings TONIGHT\n(consent · 7-clip golden set)"]
```

Why the docs go **in the repo**, not just chat: Codex treats repo files as ground truth and can re-read them on command — this is the re-anchoring mechanism used throughout (§6). Dashboard clicking (keys, buckets, env vars) is always yours; Codex can only tell you what to click.

---

## 2. STEP 1 — BOOTING THE MAIN SESSION

This is the session whose `/feedback` ID you submit. All core code (Agents A, B, C) lives here; only Agent D's narrative work runs in separate spoke sessions.

**Message #1 (verbatim):**

> Read PROJECT.md and AGENT_EXECUTION_PLAN.md fully. You will build this project with me over 2 days, playing Agents A, B, and C in turns per the plan. Do not write any code yet. First: (1) restate the build order as a ticket list, (2) list the frozen contracts you must never change, (3) flag anything in the plan that is ambiguous or technically wrong. Then wait.

```mermaid
flowchart TD
    M1["Send boot message #1"] --> R["Codex restates plan"]
    R --> V{Restatement matches\nyour intent?}
    V -- "wrong ticket order /\nmisread contract" --> C1["Correct it explicitly:\n'No — the analyze route persists a draft;\nre-read §2.4 and restate'"] --> R
    V -- "flags a real plan flaw" --> C2["Judge the flag:\naccept → amend doc in repo\nreject → explain why, proceed"] --> V
    V -- yes --> GO["Reply: 'Approved — begin C-1'"]
```

The 3-minute alignment check prevents the most expensive failure: Codex confidently building a *different* project. Never skip it.

---

## 3. STEP 2 — THE TICKET LOOP (your core rhythm, ~20 repetitions)

```mermaid
flowchart TD
    T1["1 · ASSIGN one ticket\n+ its done-criterion\n+ 'propose approach in 5 bullets first, wait'\n(for any ticket > 30 min)"] --> T2["Codex proposes approach"]
    T2 --> T3{Approach sound?}
    T3 -- no --> T3a["Redirect in one message\n(cheap now, expensive later)"] --> T2
    T3 -- yes --> T4["'Approved — build it'"]
    T4 --> T5["2 · Codex builds"]
    T5 --> T6["3 · YOU verify against done-criterion:\nrun the command · click the flow ·\ncurl the route — yourself"]
    T6 --> T7{Meets criterion?}
    T7 -- no --> T8["4 · Feed reality back VERBATIM:\npaste exact error text / screenshot\nnever paraphrase"] --> T9{Same bug after\n2 fix attempts?}
    T9 -- no --> T5
    T9 -- yes --> STRIKE["→ Three-strike recovery (§5)"]
    T7 -- yes --> T10["5 · 'Commit as ticket-id: name'"]
    T10 --> T11["Next ticket in plan order\nNEVER 'while you're at it…'"]
    T11 --> T1
```

**Ticket-assignment template (adapt per ticket):**

> Agent C, ticket C-2: migration + seed per PROJECT.md §2.3. Done when: fresh DB → `npm run seed` → 20 demo students with pre-baked assessments across all four levels, idempotent on re-run. Propose your approach in 5 bullets first and wait for my OK.

Loop laws: one ticket per message · done-criterion always included · you run the verification, never trust "it should work now" · errors pasted raw (paraphrased errors produce guessed fixes) · commit per ticket = your undo mechanism · plan order only.

---

## 4. STEP 3 — ROLE SWITCHING

```mermaid
flowchart LR
    A["Schedule says: agent handoff"] --> B["Paste the incoming agent's\nboot prompt (PLAN §2.1/§3.1/§4.1)"]
    B --> C["+ one line of state:\n'A-2/A-3 live and committed;\ngolden harness pending'"]
    C --> D["'Begin <first ticket>'"]
    D --> E["Codex now operates under\nthat agent's constraints"]
```

**Template:**

> Switching roles. [paste Agent B boot prompt]. Current state: pipeline routes A-2/A-3 are live and committed; golden harness pending. Begin B-1.

The boot prompts carry each agent's guardrails — B: *build against the mock, don't touch the live pipeline*; C: *keep main deployable every merge*. Skip them and the roles blend: B starts "helpfully" rewriting A's pipeline, and your frozen contracts start moving.

---

## 5. STEP 4 — SPECIAL-HANDLING TICKETS (where your behavior differs)

### A-1 · The risk spike (tonight, before everything)

```mermaid
flowchart TD
    A["Ask Codex for the bare\nvalidation script only"] --> B["YOU run it locally with\na real child recording"]
    B --> C["Paste raw output back"]
    C --> D["Ask the decisive question:\n'Per Gate 1 criteria in the plan,\nis this GO, MARGINAL, or FAIL?'"]
    D --> E{Codex judgment\n+ your own read}
    E -- GO --> F["Proceed to A-2"]
    E -- MARGINAL --> G["Narrow: English-only /\nolder readers → re-run"] --> B
    E -- FAIL --> H["Orchestrator pivot decision\nTONIGHT, not Tuesday"]
```

Forcing a judgment against **pre-written criteria** beats asking "does this look okay?" — vague questions get agreeable answers.

### A-5 · The analysis engine
Paste the frozen prompt + schema from PROJECT.md §2.6 **into the ticket message itself** — never let Codex re-derive them. Add: *"Implement exactly this; if you believe the prompt needs changes, propose them as a diff and wait."*

### A-6 → prompt tuning (the golden loop)

```mermaid
flowchart LR
    A["npm run golden"] --> B["Paste results table"]
    B --> C["Surgical instruction:\n'clip 3 misclassified 4 words as skipped;\nadjust ONLY the noise rule; re-run'"]
    C --> A
```

One variable per iteration. "Improve the prompt" is not an instruction; a named clip + named failure + named rule is.

### Gate checks
**You announce gates, Codex doesn't** — it has no clock. *"Gate 2 check: I'm running a golden file through the deployed URL now."* You are the schedule.

---

## 6. STEP 5 — WHEN CODEX GOES WRONG (expect 3–4 incidents)

### The three-strike recovery

```mermaid
flowchart TD
    A["Bug survives fix attempt #1"] --> B["Paste exact error again → attempt #2"]
    B --> C{Fixed?}
    C -- yes --> D["Continue loop"]
    C -- no --> E["STOP. Do NOT send 'still broken' a third time"]
    E --> F["git reset to last ticket commit"]
    F --> G["Re-assign ticket with the lesson embedded:\n'Rebuild A-3; previous attempt failed because it\nbuffered the whole file in memory; stream instead'"]
    G --> H{Clean attempt works?}
    H -- yes --> D
    H -- no --> I["ESCALATE to orchestrator (you):\nsimplify the ticket, or invoke the cut list"]
```

Re-prompting from a clean state with the failure named as a constraint beats arguing with a confused context — every time.

### Context hygiene (without breaking the /feedback rule)

```mermaid
flowchart LR
    A["Output quality dips /\nevery few hours"] --> B["Re-anchor, don't restart:\n'Stop. Re-read AGENT_EXECUTION_PLAN.md §1\nand confirm the analysis schema\nfield names before continuing'"]
    B --> C["Core work stays in Main Session\n(the /feedback ID depends on it)"]
    A2["Non-core need:\nREADME prose · video script ·\nresearch question"] --> D["Spoke session — any assistant,\nfreely disposable"]
```

---

## 7. STEP 6 — ENDGAME FLOW (Day 2, from 14:00 IST)

```mermaid
flowchart TD
    F["14:00 · Declare freeze to Codex:\n'Feature freeze. Only crashes and dead ends\nmay be fixed. Refuse anything else\nEVEN IF I ASK.'"] --> R["npm run reset-demo →\nfinal deploy → pin deployment →\nincognito checks (audio URL, all routes)"]
    R --> ST["15:00–16:00 · Stranger tests ×2\n(one tech, one non-tech friend)"]
    ST --> STQ{Both complete the loop\nunaided?}
    STQ -- no --> STF["Freeze-exempt fixes only:\ncrash / dead end / blocking copy"] --> ST
    STQ -- yes --> V["16:00–18:00 · Video shoot vs LIVE URL\ngolden recordings only, never fresh audio\n→ edit ≤ 2:40 → upload YouTube PUBLIC by 18:00"]
    V --> VC{Plays in\nlogged-out browser?}
    VC -- no --> VF["Re-upload / visibility fix\n(6 h buffer exists for this)"] --> VC
    VC -- yes --> FB["19:00 · Run /feedback in Main Session\nsave ID OUTSIDE the chat"]
    FB --> N["Ask Codex its own narrative:\n'List the 4 most significant decisions you made\nor accelerated in this build, with file references'\n→ README's Codex section, from the primary source"]
    N --> SUB["20:00–23:00 · Devpost form:\ndescription · repo · video · Session ID ·\ntrack=Education · team added → SUBMIT"]
    SUB --> SS["Screenshot confirmation →\nGate 5 closed → sleep"]
```

Note the counterintuitive instruction at freeze: you tell Codex to **resist you**. Day-2-evening feature ideas are the classic self-inflicted wound; making the agent the guardrail works.

---

## 8. QUICK-REFERENCE CARD (keep visible while building)

| Situation | Your move |
|---|---|
| Starting any ticket | One ticket, done-criterion attached, "propose 5 bullets first, wait" |
| Codex says "done" | *You* run/click/curl it — never accept "should work" |
| Any error | Paste it raw and whole; never paraphrase |
| Ticket passes | "Commit as `<id>: <name>`" → next ticket in plan order |
| Tempted to add "one small thing" | Don't. Cut list exists; wish list doesn't |
| Same bug ×2 | git reset → re-assign with the lesson embedded |
| Quality drifting | "Stop. Re-read §1 frozen contracts, confirm schema, continue" |
| Agent handoff | Boot prompt + one line of state + "Begin <ticket>" |
| A gate time arrives | You announce it and run the check — Codex has no clock |
| Non-core writing/research | Spoke session, never the Main Session |
| 14:00 Tue | Freeze — and instruct Codex to refuse features, even from you |
| 19:00 Tue | /feedback → save ID outside chat |
| ≤ 23:59 Tue IST | Submit, screenshot, done |

*End of operating procedure. Step 0 starts now; the first thing Codex ever sees from you is the Step 1 boot message.*
