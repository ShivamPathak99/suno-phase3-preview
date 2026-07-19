import { z } from "zod";

import { type ReadingAnalysis, wordStatuses } from "@/lib/analysisSchema";

export const timestampedWordSchema = z
  .object({
    word: z.string().trim().min(1),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
  })
  .strict()
  .refine(({ end, start }) => end >= start, {
    message: "end must be greater than or equal to start.",
    path: ["end"],
  });

export const timestampedTranscriptSchema = z
  .object({
    text: z.string(),
    durationSec: z.number().finite().nonnegative(),
    words: z.array(timestampedWordSchema),
  })
  .strict();

export type TimestampedTranscript = z.infer<typeof timestampedTranscriptSchema>;

/**
 * Frozen A-5 request contract. The server loads passage text from passageId;
 * clients must not send or control the passage body.
 */
export const analyzeRequestSchema = z
  .object({
    studentId: z.string().uuid(),
    passageId: z.string().uuid(),
    audioUrl: z.string().url(),
    transcript: timestampedTranscriptSchema,
  })
  .strict();

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/**
 * Frozen draft-to-confirm boundary. The confirmation route will receive this
 * assessmentId later and recompute the level after teacher overrides.
 */
export type AnalyzeResponse = {
  assessmentId: string;
  analysis: ReadingAnalysis;
};

const assessmentWordOverrideSchema = z
  .object({
    heard_as: z.string().trim().min(1).max(120).nullable(),
    passage_word_index: z.number().int().nonnegative(),
    status: z.enum(wordStatuses),
  })
  .strict();

/**
 * Frozen draft-to-confirm input. The client can only amend word markings;
 * accuracy, speed, and the level are recomputed by the server.
 */
export const confirmAssessmentRequestSchema = z
  .object({
    overrides: z.array(assessmentWordOverrideSchema),
  })
  .strict()
  .superRefine(({ overrides }, context) => {
    const seenIndexes = new Set<number>();

    overrides.forEach((override, index) => {
      if (seenIndexes.has(override.passage_word_index)) {
        context.addIssue({
          code: "custom",
          message: "Each passage word can be overridden only once.",
          path: ["overrides", index, "passage_word_index"],
        });
      }
      seenIndexes.add(override.passage_word_index);
    });
  });

export type AssessmentWordOverride = z.infer<typeof assessmentWordOverrideSchema>;
export type ConfirmAssessmentRequest = z.infer<typeof confirmAssessmentRequestSchema>;

export type ConfirmAssessmentResponse = {
  assessment: {
    accuracy_pct: number;
    analysis: ReadingAnalysis;
    id: string;
    level: ReadingAnalysis["level"];
    studentId: string;
    wcpm: number;
  };
};
