import { z } from "zod";

import type { ReadingAnalysis } from "@/lib/analysisSchema";

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
