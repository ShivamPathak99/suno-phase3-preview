import mockAnalysisJson from "../../sample-data/mock_analysis.json";

import { analysisSchema, type ReadingAnalysis } from "@/lib/analysisSchema";

export type ReadingLevel = "letter" | "word" | "paragraph" | "story";

type MockStudent = {
  id: string;
  level: ReadingLevel;
  name: string;
};

type MockPassage = {
  body: string;
  id: string;
  language: "en";
  level: ReadingLevel;
  title: string;
};

export type MockAssessmentContext = {
  /**
   * UI-only stand-in for the draft ID returned by /api/analyze. Gate 3 will
   * replace this with the real, stable assessmentId; confirmation never needs
   * a separate ID.
   */
  assessmentId: string;
  attemptNumber: number;
  passage: MockPassage;
  student: MockStudent;
};

function mockDraftAssessmentId(studentId: string) {
  const studentSuffix = studentId.match(/([0-9a-f]{12})$/iu)?.[1];
  const suffix = studentSuffix ?? "000000000000";

  return "40000000-0000-4000-8000-" + suffix;
}

const students: MockStudent[] = [
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
  level: level as ReadingLevel,
  name,
}));

const mockPassage: MockPassage = {
  body: "The cat sat on the brown mat.",
  id: "mock-word-passage",
  language: "en",
  level: "word",
  title: "Reading practice",
};

const fallbackStudent: MockStudent = {
  id: "mock-reader",
  level: "word",
  name: "Ravi",
};

/**
 * B-1 deliberately combines the seed roster with the passage that matches
 * mock_analysis.json exactly. Gate 3 will replace both with the live read path.
 */
export function getMockAssessmentContext(studentId: string): MockAssessmentContext {
  const student = students.find((candidate) => candidate.id === studentId) ?? fallbackStudent;

  return {
    assessmentId: mockDraftAssessmentId(student.id),
    attemptNumber: 2,
    passage: mockPassage,
    student,
  };
}

/** Frozen mock handoff for B-2; B-1 only uses its level after fake processing. */
export const mockReadingAnalysis: ReadingAnalysis = analysisSchema.parse(mockAnalysisJson);
