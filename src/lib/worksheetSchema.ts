import { z } from "zod";

import { readingLevels } from "@/lib/analysisSchema";

export const worksheetLanguages = ["en", "hi"] as const;

export const adaptiveWorksheetRequestSchema = z
  .object({
    focusSkillId: z.string().trim().min(1).max(80).optional(),
    studentId: z.string().uuid(),
  })
  .strict();

export const worksheetRequestSchema = z
  .object({
    adaptive: adaptiveWorksheetRequestSchema.optional(),
    level: z.enum(readingLevels),
    language: z.enum(worksheetLanguages),
  })
  .strict();

export type WorksheetRequest = z.infer<typeof worksheetRequestSchema>;
export type AdaptiveWorksheetRequest = z.infer<typeof adaptiveWorksheetRequestSchema>;

/** The frozen C-4 worksheet response shape. */
export const worksheetContentSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(1_500),
    question: z.string().trim().min(1).max(180),
  })
  .strict();

export type WorksheetContent = z.infer<typeof worksheetContentSchema>;

export const worksheetWordCountBands = {
  letter: { min: 10, max: 16 },
  word: { min: 8, max: 12 },
  paragraph: { min: 35, max: 55 },
  story: { min: 80, max: 120 },
} as const;

/**
 * Strict Structured Outputs schema for GPT-5.6. Semantic checks such as
 * word-count bands are enforced locally below because JSON Schema cannot
 * count natural-language tokens reliably.
 */
export const worksheetJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body", "question"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 80 },
    body: { type: "string", minLength: 1, maxLength: 1_500 },
    question: { type: "string", minLength: 1, maxLength: 180 },
  },
} as const;

function validationMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "worksheet"}: ${issue.message}`)
    .join("; ");
}

/** Counts Unicode words, including Devanagari words with combining marks. */
export function worksheetWordCount(text: string) {
  return text.match(/[\p{L}\p{M}\p{N}]+/gu)?.length ?? 0;
}

/**
 * Checks the schema and the level-specific content constraints required by
 * C-EC9. It intentionally returns only the frozen content shape.
 */
export function validateWorksheet(
  value: unknown,
  level: WorksheetRequest["level"],
): WorksheetContent {
  const parsed = worksheetContentSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(`Worksheet schema validation failed: ${validationMessage(parsed.error)}`);
  }

  const wordCount = worksheetWordCount(parsed.data.body);
  const band = worksheetWordCountBands[level];

  if (wordCount < band.min || wordCount > band.max) {
    throw new Error(
      `A ${level}-level worksheet body must contain ${band.min}-${band.max} words or letters; received ${wordCount}.`,
    );
  }

  if (!/^(?=[^?]*[\p{L}\p{M}\p{N}])[^?]*\?\s*$/u.test(parsed.data.question)) {
    throw new Error(
      "Worksheet question must contain text and exactly one trailing question mark.",
    );
  }

  return parsed.data;
}
