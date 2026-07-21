import assert from "node:assert/strict";

import { analysisSchema } from "../src/lib/analysisSchema";
import { recomputeConfirmedReadingAnalysis } from "../src/lib/assessment-confirmation";
import {
  getStepUpEligibility,
  isStepUpAttempt,
  nextReadingLevel,
  type StepUpHistoryAssessment,
} from "../src/lib/adaptive/step-up-probe";
import type { ReadingLevel } from "../src/lib/assessment-types";

function analysisWithStatuses(statuses: Array<"correct" | "hesitation" | "skipped">) {
  return analysisSchema.parse({
    accuracy_pct: 0,
    level: "letter",
    recommended_focus: "Keep reading steadily.",
    summary_for_teacher: "Fixture result.",
    wcpm: 0,
    words: statuses.map((status, index) => ({
      confidence: "high",
      heard_as: null,
      passage_word: `word${index + 1}`,
      status,
    })),
  });
}

function benchmark({
  accuracy = 92,
  analysis = analysisWithStatuses(["correct", "correct", "correct", "hesitation"]),
  createdAt = "2026-07-22T09:00:00.000Z",
  id = "benchmark-1",
  level = "letter",
}: {
  accuracy?: number;
  analysis?: unknown;
  createdAt?: string;
  id?: string;
  level?: ReadingLevel;
} = {}): StepUpHistoryAssessment {
  return {
    accuracy,
    analysis_json: analysis,
    created_at: createdAt,
    id,
    level,
    student_id: "student-1",
  };
}

const secureLetter = benchmark();
assert.deepEqual(
  getStepUpEligibility({ confirmedAssessments: [secureLetter], student: {} }),
  { baseLevel: "letter", targetLevel: "word" },
  "A 90%+ benchmark with at most one hesitation should offer the next level.",
);
assert.deepEqual(
  isStepUpAttempt({
    attemptedLevel: "word",
    confirmedAssessments: [secureLetter],
    student: {},
  }),
  { baseLevel: "letter", targetLevel: "word" },
);
assert.equal(
  getStepUpEligibility({
    confirmedAssessments: [secureLetter],
    student: { placement_source: "teacher", teacher_placement_level: "letter" },
  }),
  null,
  "A provisional teacher placement must never create a step-up probe.",
);

const practiceRead = benchmark({
  analysis: {
    _adaptive: { purpose: "focused_readback" },
    ...analysisWithStatuses(["correct", "correct", "correct", "correct"]),
  },
  createdAt: "2026-07-23T09:00:00.000Z",
  id: "practice-read",
  level: "story",
});
assert.deepEqual(
  getStepUpEligibility({ confirmedAssessments: [secureLetter, practiceRead], student: {} }),
  { baseLevel: "letter", targetLevel: "word" },
  "Practice reads must remain invisible to step-up eligibility.",
);
assert.equal(
  getStepUpEligibility({
    confirmedAssessments: [benchmark({ level: "story" })],
    student: {},
  }),
  null,
  "Story is the top level and cannot create a broken L+1 probe.",
);

const exactEighty = recomputeConfirmedReadingAnalysis({
  analysis: analysisWithStatuses(["correct", "correct", "correct", "correct", "skipped"]),
  attemptedLevel: "word",
  durationSec: 30,
  overrides: [],
  stepUpBaseLevel: "letter",
});
assert.equal(exactEighty.accuracyPct, 80);
assert.equal(exactEighty.analysis.level, "word", "Exactly 80% must promote a valid step-up.");

for (const baseLevel of ["letter", "word", "paragraph"] as const) {
  const targetLevel = nextReadingLevel(baseLevel);
  assert.ok(targetLevel);

  for (const statuses of [
    ["skipped", "skipped", "skipped", "skipped"],
    ["correct", "skipped", "skipped", "skipped"],
    ["correct", "correct", "correct", "skipped"],
  ] as const) {
    const result = recomputeConfirmedReadingAnalysis({
      analysis: analysisWithStatuses([...statuses]),
      attemptedLevel: targetLevel,
      durationSec: 30,
      overrides: [],
      stepUpBaseLevel: baseLevel,
    });
    assert.equal(
      result.analysis.level,
      baseLevel,
      `A failed ${baseLevel}-to-${targetLevel} step-up must hold, never demote.`,
    );
  }
}

console.log("P3-T10 step-up probe passed: eligibility, practice exclusion, 80% boundary, and never-demote property.");
