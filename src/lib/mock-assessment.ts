import mockAnalysisJson from "../../sample-data/mock_analysis.json";

import { analysisSchema, type ReadingAnalysis } from "@/lib/analysisSchema";

export type ReadingLevel = "letter" | "word" | "paragraph" | "story";

export type MockStudent = {
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
  purpose: "benchmark";
  student: MockStudent;
};

export function mockDraftAssessmentId(studentId: string) {
  const studentSuffix = studentId.match(/([0-9a-f]{12})$/iu)?.[1];
  const suffix = studentSuffix ?? "000000000000";

  return "40000000-0000-4000-8000-" + suffix;
}

export const mockStudents: MockStudent[] = [
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

/** Debug-only B-5 fixture; it is deliberately not part of the seeded roster. */
export const mockEmptyStudent: MockStudent = {
  id: "10000000-0000-4000-8000-000000000021",
  level: "word",
  name: "Meera",
};

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
  const student =
    mockStudents.find((candidate) => candidate.id === studentId) ??
    (studentId === mockEmptyStudent.id ? mockEmptyStudent : fallbackStudent);

  return {
    assessmentId: mockDraftAssessmentId(student.id),
    attemptNumber: student.id === mockEmptyStudent.id ? 1 : 2,
    passage: mockPassage,
    purpose: "benchmark",
    student,
  };
}

/** Frozen mock handoff for B-2; B-1 only uses its level after fake processing. */
export const mockReadingAnalysis: ReadingAnalysis = analysisSchema.parse(mockAnalysisJson);
