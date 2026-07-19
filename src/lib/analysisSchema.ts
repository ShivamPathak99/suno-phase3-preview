import { z } from "zod";

export const readingLevels = ["letter", "word", "paragraph", "story"] as const;
export const wordStatuses = [
  "correct",
  "substituted",
  "skipped",
  "hesitation",
  "unclear",
] as const;
export const confidenceLevels = ["high", "medium", "low"] as const;

export const analysisWordSchema = z
  .object({
    passage_word: z.string(),
    status: z.enum(wordStatuses),
    heard_as: z.string().nullable(),
    confidence: z.enum(confidenceLevels),
  })
  .strict();

/** The frozen analysis shape used by the draft record and confirm UI. */
export const analysisSchema = z
  .object({
    level: z.enum(readingLevels),
    wcpm: z.number().finite().nonnegative(),
    accuracy_pct: z.number().finite().min(0).max(100),
    words: z.array(analysisWordSchema),
    summary_for_teacher: z.string(),
    recommended_focus: z.string(),
  })
  .strict();

export type ReadingAnalysis = z.infer<typeof analysisSchema>;

/**
 * The JSON Schema sent to GPT-5.6. Every field is required and no additional
 * fields are allowed, including within each word result.
 */
export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "level",
    "wcpm",
    "accuracy_pct",
    "words",
    "summary_for_teacher",
    "recommended_focus",
  ],
  properties: {
    level: {
      type: "string",
      enum: readingLevels,
    },
    wcpm: { type: "number", minimum: 0 },
    accuracy_pct: { type: "number", minimum: 0, maximum: 100 },
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["passage_word", "status", "heard_as", "confidence"],
        properties: {
          passage_word: { type: "string" },
          status: {
            type: "string",
            enum: wordStatuses,
          },
          heard_as: { type: ["string", "null"] },
          confidence: {
            type: "string",
            enum: confidenceLevels,
          },
        },
      },
    },
    summary_for_teacher: { type: "string" },
    recommended_focus: { type: "string" },
  },
} as const;

function canonicalPassageWord(word: string) {
  return word
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "")
    .normalize("NFC");
}

function passageWords(passageText: string) {
  return passageText.split(/\s+/u).map(canonicalPassageWord).filter(Boolean);
}

function validationMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "analysis"}: ${issue.message}`)
    .join("; ");
}

/**
 * Verifies the strict model response and that it marks every canonical passage
 * word, in order. This complements Structured Outputs with the relationship
 * that JSON Schema cannot express.
 */
export function validateReadingAnalysis(
  value: unknown,
  passageText: string,
): ReadingAnalysis {
  const parsed = analysisSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(`Analysis schema validation failed: ${validationMessage(parsed.error)}`);
  }

  const expectedWords = passageWords(passageText);

  if (expectedWords.length === 0) {
    throw new Error("The selected passage has no assessable words.");
  }

  if (parsed.data.words.length !== expectedWords.length) {
    throw new Error(
      `Analysis must mark all ${expectedWords.length} passage words, received ${parsed.data.words.length}.`,
    );
  }

  for (const [index, expectedWord] of expectedWords.entries()) {
    const actualWord = parsed.data.words[index]?.passage_word;

    if (!actualWord || canonicalPassageWord(actualWord) !== expectedWord) {
      throw new Error(
        `Analysis word ${index + 1} must be ${JSON.stringify(expectedWord)}, received ${JSON.stringify(actualWord)}.`,
      );
    }
  }

  return parsed.data;
}
