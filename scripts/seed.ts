import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createAdaptiveConfirmation, type AdaptiveAssessmentPayload } from "../src/lib/adaptive/confirmation";
import {
  getCuratedCard,
  passageMetadataForCuratedCard,
  type CuratedCard,
} from "../src/lib/adaptive/card-catalog";
import { createAdaptiveWorksheetContent } from "../src/lib/adaptive/worksheet";
import { validateAdaptiveCard } from "../src/lib/adaptive/validation";
import { mathInstrumentPassageId } from "../src/lib/adaptive/math/check-contract";

type Level = "letter" | "word" | "paragraph" | "story";
type Language = "en" | "hi";
type WordStatus =
  | "correct"
  | "substituted"
  | "skipped"
  | "hesitation"
  | "unclear";
type Confidence = "high" | "medium" | "low";

type Passage = {
  id: string;
  level: Level;
  language: Language;
  title: string;
  body: string;
};

type Student = {
  id: string;
  name: string;
  grade: string;
  avatar_seed: string;
  is_demo: boolean;
  level: Level;
};

type AnalysisWord = {
  passage_word: string;
  status: WordStatus;
  heard_as: string | null;
  confidence: Confidence;
};

type Analysis = {
  level: Level;
  wcpm: number;
  accuracy_pct: number;
  words: AnalysisWord[];
  summary_for_teacher: string;
  recommended_focus: string;
};

type SeededPracticeReadback = {
  analysis: Analysis;
  adaptive: AdaptiveAssessmentPayload;
  card: CuratedCard;
  createdAt: string;
  id: string;
  passageId: string;
  worksheetId: string;
};

const passages: Passage[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    level: "letter",
    language: "en",
    title: "Letters",
    body: "M S A T\nP N I C\nO B D G\nR E L H",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    level: "letter",
    language: "hi",
    title: "अक्षर",
    body: "अ आ इ उ\nक म न प\nब र ल स\nत द ग ह",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    level: "word",
    language: "en",
    title: "Everyday Words",
    body: "sun\nbus\ncup\nred\nfish\nbook\nmilk\nhand\nmango\nwater\nschool\nchair\nplant\nsmile\nfriend\npencil\nwindow\norange\nmarket\nbasket",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    level: "word",
    language: "hi",
    title: "रोज़ के शब्द",
    body: "घर\nनल\nबस\nफल\nरस\nकमल\nकलम\nमाँ\nपानी\nदूध\nकिताब\nबस्ता\nपेंसिल\nखिड़की\nस्कूल\nबगीचा\nआम\nबादल\nरोटी\nदोस्त",
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    level: "paragraph",
    language: "en",
    title: "The School Garden",
    body: "At school, children water a small garden. They fill a can at the tap and give each plant a drink. Later, they see new green leaves. The class smiles.",
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    level: "paragraph",
    language: "hi",
    title: "स्कूल का बगीचा",
    body: "स्कूल में बच्चे छोटे बगीचे को पानी देते हैं। वे नल से बाल्टी भरते हैं और हर पौधे को पानी देते हैं। दोपहर में उन्हें नई हरी पत्तियाँ दिखती हैं। कक्षा खुश होती है।",
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    level: "story",
    language: "en",
    title: "The Lunch Box",
    body: "On a rainy morning, Meena carried her lunch box to school. At break time, she could not find it. She looked under her desk. A friend saw the box by the shoe rack. Meena thanked her friend and shared a banana. Then they hurried back to class before the bell rang.",
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    level: "story",
    language: "hi",
    title: "टिफिन कहाँ है?",
    body: "मीना टिफिन लेकर स्कूल गई। अवकाश में उसका टिफिन नहीं मिला। उसने मेज के नीचे देखा। एक दोस्त ने टिफिन जूतों के पास पाया। मीना ने धन्यवाद कहा और केले के दो टुकड़े बाँटे। फिर दोनों घंटी से पहले कक्षा में लौट गईं।",
  },
];

/** Database-table-preserving sentinel for `math-check.v1` assessment rows. */
const mathInstrumentPassage: Passage = {
  body: "Math instrument — not a reading passage.",
  id: mathInstrumentPassageId,
  language: "en",
  level: "word",
  title: "Math instrument",
};

const students: Student[] = [
  ["Aarti", "letter"],
  ["Babu", "letter"],
  ["Chitra", "letter"],
  ["Deepak", "letter"],
  ["Farah", "letter"],
  ["Gopal", "word"],
  ["Isha", "word"],
  ["Kabir", "word"],
  ["Lata", "word"],
  ["Mohan", "word"],
  ["Maya", "word"],
  ["Om", "paragraph"],
  ["Pooja", "paragraph"],
  ["Rohan", "paragraph"],
  ["Saira", "paragraph"],
  ["Tarun", "paragraph"],
  ["Uma", "story"],
  ["Varun", "story"],
  ["Zoya", "story"],
  ["Aarav", "story"],
].map(([name, level], index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  name,
  grade: "3",
  avatar_seed: name.toLowerCase(),
  is_demo: true,
  level: level as Level,
}));

export const demoStudentIds = students.map((student) => student.id);
export const demoAssessmentIds = students.map(
  (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

function requiredMayaStudent() {
  const maya = students.find((student) => student.name === "Maya");

  if (!maya) {
    throw new Error("The Phase 2 demo needs Maya in the seeded classroom.");
  }

  return maya;
}

const mayaStudent = requiredMayaStudent();

const mayaPracticePassageIds = [
  "20000000-0000-4000-8000-000000000009",
  "20000000-0000-4000-8000-000000000010",
] as const;
const mayaPracticeAssessmentIds = [
  "30000000-0000-4000-8000-000000000021",
  "30000000-0000-4000-8000-000000000022",
] as const;
const mayaBaselineAssessmentIds = [
  "30000000-0000-4000-8000-000000000023",
  "30000000-0000-4000-8000-000000000024",
] as const;
const mayaPracticeWorksheetIds = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
] as const;

demoAssessmentIds.push(...mayaPracticeAssessmentIds, ...mayaBaselineAssessmentIds);

const levelProfiles: Record<
  Level,
  {
    wcpm: number;
    accuracy: number;
    summary: string;
    focus: string;
    markedWordIndexes: Array<[number, WordStatus]>;
  }
> = {
  letter: {
    wcpm: 8,
    accuracy: 62,
    summary:
      "This reader recognises several letters but pauses and confuses some shapes. Start with short daily letter-sound practice.",
    focus: "Matching letters to their sounds",
    markedWordIndexes: [
      [3, "hesitation"],
      [7, "unclear"],
      [11, "skipped"],
    ],
  },
  word: {
    wcpm: 22,
    accuracy: 82,
    summary:
      "This reader recognises familiar words and needs more practice with longer words. They are ready for focused word-level work.",
    focus: "Blending sounds in longer familiar words",
    markedWordIndexes: [
      [8, "hesitation"],
      [15, "substituted"],
    ],
  },
  paragraph: {
    wcpm: 39,
    accuracy: 93,
    summary:
      "This reader follows short connected text with occasional pauses. Continue building fluency through repeated paragraph reading.",
    focus: "Reading short connected text smoothly",
    markedWordIndexes: [[9, "hesitation"]],
  },
  story: {
    wcpm: 58,
    accuracy: 98,
    summary:
      "This reader sustains a short story smoothly and understands its sequence. Keep offering story-level practice.",
    focus: "Discussing story sequence and meaning",
    markedWordIndexes: [],
  },
};

function wordsForPassage(body: string) {
  return body
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
}

function makeAnalysis(level: Level, passage: Passage, variation: number): Analysis {
  const profile = levelProfiles[level];
  const markedWords = new Map(profile.markedWordIndexes);
  const words = wordsForPassage(passage.body).map((passageWord, index) => {
    const status = markedWords.get(index) ?? "correct";
    const confidence: Confidence =
      status === "unclear" ? "low" : status === "correct" ? "high" : "medium";

    return {
      passage_word: passageWord,
      status,
      heard_as:
        status === "substituted" ? `${passageWord.slice(0, -1) || passageWord}a` : null,
      confidence,
    };
  });

  return {
    level,
    wcpm: profile.wcpm + (variation % 4),
    accuracy_pct: Math.min(profile.accuracy + (variation % 3), 100),
    words,
    summary_for_teacher: profile.summary,
    recommended_focus: profile.focus,
  };
}

function practiceOutcomes(
  card: CuratedCard,
  outcomes: ReadonlyArray<"correct" | "hesitation" | "substituted">,
) {
  const targets = card.tokens.filter((token) => token.controlledExemplar);

  return targets.map((token, index) => ({
    confidence: "high" as const,
    confirmation: "edited" as const,
    outcome: outcomes[index] ?? "correct",
    passageWordIndex: token.index,
  }));
}

export function mayaPrerequisiteHistory(): AdaptiveAssessmentPayload[] {
  const skills = ["en.cvc.short_a", "en.cvc.short_i"] as const;

  return mayaBaselineAssessmentIds.map((assessmentId, assessmentIndex) => ({
    candidateSignals: [],
    evidence: skills.flatMap((skillId) =>
      Array.from({ length: 6 }, (_, wordIndex) => ({
        accuracyCredit: 1,
        assessmentId,
        automaticityCredit: 1,
        directness: 1 as const,
        distinctWordKey: `${skillId}.demo.${assessmentIndex}.${wordIndex}`,
        occurredAt: `2026-07-${String(17 + assessmentIndex).padStart(2, "0")}T08:00:00.000Z`,
        outcome: "correct" as const,
        purpose: "benchmark" as const,
        skillId,
        studentId: mayaStudent.id,
        teacherConfirmed: true,
        v: "adaptive-evidence.v1" as const,
        weight: 1,
      })),
    ),
    evidenceSummaryBySkill: {},
    focus: {
      kind: "general_card" as const,
      reason: "Maya has secure CVC foundations in this seeded baseline.",
      source: "general" as const,
    },
    purpose: "benchmark" as const,
    v: "adaptive-evidence.v1" as const,
  }));
}

function practiceAnalysis(card: CuratedCard, outcomes: ReturnType<typeof practiceOutcomes>): Analysis {
  const outcomeByIndex = new Map(outcomes.map((outcome) => [outcome.passageWordIndex, outcome.outcome]));
  const words = wordsForPassage(card.body).map((passageWord, index) => {
    const status = outcomeByIndex.get(index) ?? "correct";

    return {
      confidence: status === "correct" ? ("high" as const) : ("medium" as const),
      heard_as: status === "substituted" ? `${passageWord.slice(0, -1)}p` : null,
      passage_word: passageWord,
      status,
    };
  });
  const difficultWords = words.filter((word) => word.status !== "correct").length;
  const accuracy = Math.round(((words.length - difficultWords) / words.length) * 100);

  return {
    accuracy_pct: accuracy,
    level: "word",
    recommended_focus: "Keep reading the new story together.",
    summary_for_teacher: "This is a confirmed practice read. Keep the next card fresh and encouraging.",
    wcpm: 30,
    words,
  };
}

/**
 * Two pre-confirmed practice reads make the Phase 2 loop visible without a
 * live recording: the first keeps sh words active; the second demonstrates a
 * changed recommendation. Both are explicitly `focused_readback` data.
 */
export function createMayaDemoLoop(): SeededPracticeReadback[] {
  const firstCard = getCuratedCard("en.digraph.sh.card1");
  const secondCard = getCuratedCard("en.digraph.sh.card2");

  if (!firstCard || !secondCard) {
    throw new Error("The Phase 2 demo cards are missing from the curated catalog.");
  }

  const firstOutcomes = practiceOutcomes(firstCard, [
    "substituted",
    "substituted",
    "substituted",
    "correct",
    "correct",
  ]);
  const historicalAdaptiveAssessments = mayaPrerequisiteHistory();
  const firstAdaptive = createAdaptiveConfirmation({
    assessment: {
      assessmentId: mayaPracticeAssessmentIds[0],
      occurredAt: "2026-07-19T09:00:00.000Z",
      purpose: "focused_readback",
      studentId: mayaStudent.id,
      teacherConfirmed: true,
    },
    confirmedReadingCount: 4,
    historicalAdaptiveAssessments,
    passage: passageMetadataForCuratedCard(firstCard, mayaPracticePassageIds[0]),
    scope: { level: "word", studentName: mayaStudent.name },
    wordOutcomes: firstOutcomes,
  });

  const secondOutcomes = practiceOutcomes(secondCard, [
    "correct",
    "correct",
    "correct",
    "correct",
    "correct",
  ]);
  const secondAdaptive = createAdaptiveConfirmation({
    assessment: {
      assessmentId: mayaPracticeAssessmentIds[1],
      occurredAt: "2026-07-20T09:00:00.000Z",
      purpose: "focused_readback",
      studentId: mayaStudent.id,
      teacherConfirmed: true,
    },
    confirmedReadingCount: 5,
    historicalAdaptiveAssessments: [...historicalAdaptiveAssessments, firstAdaptive],
    passage: passageMetadataForCuratedCard(secondCard, mayaPracticePassageIds[1]),
    scope: { level: "word", studentName: mayaStudent.name },
    wordOutcomes: secondOutcomes,
  });

  return [
    {
      adaptive: firstAdaptive,
      analysis: practiceAnalysis(firstCard, firstOutcomes),
      card: firstCard,
      createdAt: "2026-07-19T09:00:00.000Z",
      id: mayaPracticeAssessmentIds[0],
      passageId: mayaPracticePassageIds[0],
      worksheetId: mayaPracticeWorksheetIds[0],
    },
    {
      adaptive: secondAdaptive,
      analysis: practiceAnalysis(secondCard, secondOutcomes),
      card: secondCard,
      createdAt: "2026-07-20T09:00:00.000Z",
      id: mayaPracticeAssessmentIds[1],
      passageId: mayaPracticePassageIds[1],
      worksheetId: mayaPracticeWorksheetIds[1],
    },
  ];
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const candidate = error as {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      message?: unknown;
    };
    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.code,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return "Unknown error";
}

export function createDemoSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function upsert(
  supabase: SupabaseClient,
  table: string,
  rows: unknown[],
  ignoreExistingRows = false,
) {
  const { error } = await supabase.from(table).upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: ignoreExistingRows,
  });

  if (error) {
    throw error;
  }
}

export async function seedDemoData(supabase: SupabaseClient) {
  const mayaLoop = createMayaDemoLoop();
  const practicePassages: Passage[] = mayaLoop.map((readback) => ({
    body: readback.card.body,
    id: readback.passageId,
    language: readback.card.language,
    level: readback.card.level,
    title: readback.card.title,
  }));
  const seededPassages = [...passages, ...practicePassages, mathInstrumentPassage];

  await upsert(
    supabase,
    "passages",
    seededPassages.map(({ id, level, language, title, body }) => ({
        id,
        level,
        language,
        title,
        body,
    })),
    true,
  );

  await upsert(
    supabase,
    "students",
    students.map(({ id, name, grade, avatar_seed, is_demo }) => ({
        id,
        name,
        grade,
        avatar_seed,
        is_demo,
    })),
  );

  const englishPassageByLevel = new Map(
    passages
      .filter((passage) => passage.language === "en")
      .map((passage) => [passage.level, passage]),
  );

  const baselineAssessments = students.map((student, index) => {
    const passage = englishPassageByLevel.get(student.level);

    if (!passage) {
      throw new Error(`Missing English passage for ${student.level}.`);
    }

    const analysis = makeAnalysis(student.level, passage, index);
    const transcriptWords = analysis.words.map((word, wordIndex) => ({
      word: word.passage_word,
      start: Number((wordIndex * 0.7).toFixed(2)),
      end: Number((wordIndex * 0.7 + 0.45).toFixed(2)),
    }));

    return {
      id: demoAssessmentIds[index],
      student_id: student.id,
      passage_id: passage.id,
      audio_url: null,
      transcript_json: {
        text: passage.body,
        words: transcriptWords,
      },
      analysis_json: analysis,
      level: analysis.level,
      wcpm: analysis.wcpm,
      accuracy: analysis.accuracy_pct,
      teacher_confirmed: true,
      created_at: new Date(Date.UTC(2026, 6, 18, 8, index, 0)).toISOString(),
    };
  });
  const wordPassage = englishPassageByLevel.get("word");

  if (!wordPassage) {
    throw new Error("Missing English word passage for Maya's seeded baseline history.");
  }

  const mayaBaselineHistory = mayaPrerequisiteHistory();
  const mayaBaselineAssessments = mayaBaselineHistory.map((adaptive, index) => {
    const analysis = makeAnalysis("word", wordPassage, index);

    return {
      accuracy: analysis.accuracy_pct,
      analysis_json: { ...analysis, _adaptive: adaptive },
      audio_url: null,
      created_at: `2026-07-${String(17 + index).padStart(2, "0")}T08:00:00.000Z`,
      id: mayaBaselineAssessmentIds[index],
      level: analysis.level,
      passage_id: wordPassage.id,
      student_id: mayaStudent.id,
      teacher_confirmed: true,
      transcript_json: { text: wordPassage.body, words: [] },
      wcpm: analysis.wcpm,
    };
  });

  await upsert(
    supabase,
    "assessments",
    [
      ...baselineAssessments,
      ...mayaBaselineAssessments,
      ...mayaLoop.map((readback) => ({
        accuracy: readback.analysis.accuracy_pct,
        analysis_json: { ...readback.analysis, _adaptive: readback.adaptive },
        audio_url: null,
        created_at: readback.createdAt,
        id: readback.id,
        level: readback.analysis.level,
        passage_id: readback.passageId,
        student_id: mayaStudent.id,
        teacher_confirmed: true,
        transcript_json: {
          text: readback.card.body,
          words: readback.analysis.words.map((word, wordIndex) => ({
            end: Number((wordIndex * 0.7 + 0.45).toFixed(2)),
            start: Number((wordIndex * 0.7).toFixed(2)),
            word: word.passage_word,
          })),
        },
        wcpm: readback.analysis.wcpm,
      })),
    ],
  );

  const firstFocus = mayaLoop[0]?.adaptive.focus;
  if (!firstFocus || firstFocus.kind !== "focused_card") {
    throw new Error("Maya's first practice read must start with a focused card.");
  }

  await upsert(
    supabase,
    "worksheets",
    mayaLoop.map((readback) => {
      const qualityChecks = validateAdaptiveCard(readback.card, {
        focusSkillId: firstFocus.skillId,
        language: "en",
        level: "word",
      }).qualityChecks;
      const contentJson = createAdaptiveWorksheetContent({
        card: readback.card,
        focus: firstFocus,
        passageId: readback.passageId,
        qualityChecks,
        studentId: mayaStudent.id,
      });

      return {
        content_json: contentJson,
        id: readback.worksheetId,
        language: "en",
        level: "word",
      };
    }),
  );

  const [{ count: studentCount, error: studentCountError }, { count: passageCount, error: passageCountError }, { count: assessmentCount, error: assessmentCountError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("is_demo", true),
      supabase
        .from("passages")
        .select("*", { count: "exact", head: true })
        .in(
          "id",
          seededPassages.map((passage) => passage.id),
        ),
      supabase
        .from("assessments")
        .select("*", { count: "exact", head: true })
        .in(
          "student_id",
          students.map((student) => student.id),
        ),
    ]);

  if (studentCountError || passageCountError || assessmentCountError) {
    throw studentCountError ?? passageCountError ?? assessmentCountError;
  }

  if (studentCount !== 20 || passageCount !== 11 || assessmentCount !== 24) {
    throw new Error(
      `Unexpected demo seed counts: students=${studentCount}, passages=${passageCount}, assessments=${assessmentCount}.`,
    );
  }

  return { assessmentCount, passageCount, studentCount };
}

async function main() {
  try {
    const result = await seedDemoData(createDemoSupabaseAdminClient());
    console.log(
      `Seed complete: ${result.studentCount} demo students, ${result.passageCount} passages, ${result.assessmentCount} confirmed demo assessments.`,
    );
  } catch (error) {
    const message = describeError(error);

    if (message.includes("relation \"students\" does not exist")) {
      console.error(
        "Seed failed: apply supabase/migrations/0001_initial_schema.sql in the Supabase SQL Editor before running npm run seed.",
      );
    } else {
      console.error(`Seed failed: ${message}`);
    }

    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main();
}
