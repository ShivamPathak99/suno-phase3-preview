import mockAnalysis from "../sample-data/mock_analysis.json";
import {
  analysisJsonSchema,
  analysisSchema,
  validateReadingAnalysis,
} from "../src/lib/analysisSchema";
import { analyzeRequestSchema } from "../src/lib/assessment-contract";

function verify(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const passage = "The cat sat on the brown mat";

validateReadingAnalysis(mockAnalysis, passage);
verify(
  analysisSchema.safeParse({ ...mockAnalysis, unexpected: true }).success === false,
  "Analysis must reject unexpected top-level fields.",
);

const wrongPassageWord = structuredClone(mockAnalysis);
wrongPassageWord.words[2].passage_word = "sit";

let rejectedWrongWord = false;

try {
  validateReadingAnalysis(wrongPassageWord, passage);
} catch {
  rejectedWrongWord = true;
}

verify(rejectedWrongWord, "Analysis must preserve every canonical passage word.");
const punctuationAnalysis = structuredClone(mockAnalysis);
punctuationAnalysis.words[2].passage_word = "sat,";
punctuationAnalysis.words[6].passage_word = "mat.";
validateReadingAnalysis(punctuationAnalysis, "The cat sat, on the brown mat.");

validateReadingAnalysis(
  {
    level: "word",
    wcpm: 12,
    accuracy_pct: 100,
    words: [
      {
        passage_word: "स्कूल",
        status: "correct",
        heard_as: null,
        confidence: "high",
      },
      {
        passage_word: "में",
        status: "correct",
        heard_as: null,
        confidence: "high",
      },
      {
        passage_word: "बच्चे",
        status: "correct",
        heard_as: null,
        confidence: "high",
      },
    ],
    summary_for_teacher: "The child read the words clearly.",
    recommended_focus: "Continue daily word reading.",
  },
  "स्कूल में बच्चे",
);
verify(
  analysisSchema.safeParse({ ...mockAnalysis, accuracy_pct: 101 }).success === false,
  "Analysis accuracy must remain between 0 and 100.",
);
verify(
  analysisSchema.safeParse({ ...mockAnalysis, wcpm: -1 }).success === false,
  "Analysis WCPM must not be negative.",
);
verify(
  analysisJsonSchema.additionalProperties === false &&
    analysisJsonSchema.properties.words.items.additionalProperties === false,
  "The JSON Schema must disallow extra object fields at every level.",
);
verify(
  analyzeRequestSchema.safeParse({
    studentId: "10000000-0000-4000-8000-000000000001",
    passageId: "20000000-0000-4000-8000-000000000005",
    audioUrl: "https://example.supabase.co/storage/v1/object/public/audio/test.webm",
    transcript: {
      text: "The cat sat on the brown mat",
      durationSec: 8,
      words: [
        { word: "The", start: 0, end: 0.4 },
        { word: "cat", start: 0.5, end: 0.8 },
        { word: "sat", start: 0.9, end: 1.2 },
      ],
    },
  }).success,
  "The frozen A-5 request envelope must remain valid.",
);

console.log("Analysis contract passed: mock shape, strict fields, word alignment, and draft envelope.");
