import { createClient } from "@supabase/supabase-js";

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
  ["Nisha", "word"],
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

function fail(message: string): never {
  console.error(`Seed failed: ${message}`);
  process.exit(1);
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

async function upsert(table: string, rows: unknown[]) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

async function main() {
  try {
    await upsert(
      "passages",
      passages.map(({ id, level, language, title, body }) => ({
        id,
        level,
        language,
        title,
        body,
      })),
    );

    await upsert(
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

    await upsert(
      "assessments",
      students.map((student, index) => {
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
          id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
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
      }),
    );

    const [{ count: studentCount, error: studentCountError }, { count: passageCount, error: passageCountError }, { count: assessmentCount, error: assessmentCountError }] =
      await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("passages").select("*", { count: "exact", head: true }),
        supabase.from("assessments").select("*", { count: "exact", head: true }),
      ]);

    if (studentCountError || passageCountError || assessmentCountError) {
      throw studentCountError ?? passageCountError ?? assessmentCountError;
    }

    if (studentCount !== 20 || passageCount !== 8 || assessmentCount !== 20) {
      throw new Error(
        `Unexpected seed counts: students=${studentCount}, passages=${passageCount}, assessments=${assessmentCount}.`,
      );
    }

    console.log("Seed complete: 20 students, 8 passages, 20 confirmed assessments.");
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

void main();
