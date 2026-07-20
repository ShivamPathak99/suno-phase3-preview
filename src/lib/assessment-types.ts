import type { ReadingAnalysis } from "@/lib/analysisSchema";
import type { ReadingPurpose } from "@/lib/adaptive/types";

export type ReadingLevel = ReadingAnalysis["level"];

export type AssessmentStudent = {
  id: string;
  name: string;
};

export type AssessmentPassage = {
  body: string;
  id: string;
  language: "en" | "hi";
  level: ReadingLevel;
  title: string;
};

/**
 * The UI-safe context for a reading attempt. It deliberately contains no
 * transcript or audio URL: those remain in the draft assessment on the server.
 */
export type AssessmentContext = {
  attemptNumber: number;
  passage: AssessmentPassage;
  purpose: ReadingPurpose;
  student: AssessmentStudent;
};
