import assert from "node:assert/strict";

import { analysisSchema } from "../src/lib/analysisSchema";
import { recomputeConfirmedReadingAnalysis } from "../src/lib/assessment-confirmation";
import { confirmAssessmentRequestSchema } from "../src/lib/assessment-contract";

const draftAnalysis = analysisSchema.parse({
  accuracy_pct: 50,
  level: "story",
  recommended_focus: "Reading connected text smoothly",
  summary_for_teacher: "Draft model summary.",
  wcpm: 10,
  words: [
    { confidence: "high", heard_as: null, passage_word: "The", status: "correct" },
    { confidence: "medium", heard_as: "a", passage_word: "child", status: "substituted" },
    { confidence: "medium", heard_as: null, passage_word: "reads", status: "hesitation" },
    { confidence: "low", heard_as: null, passage_word: "today", status: "skipped" },
  ],
});

const corrected = recomputeConfirmedReadingAnalysis({
  analysis: draftAnalysis,
  attemptedLevel: "story",
  durationSec: 20,
  overrides: [
    { heard_as: null, passage_word_index: 1, status: "correct" },
    { heard_as: null, passage_word_index: 3, status: "correct" },
  ],
});

assert.equal(corrected.accuracyPct, 100);
assert.equal(corrected.wcpm, 12);
assert.equal(corrected.analysis.level, "story");
assert.equal(corrected.analysis.words[1]?.status, "correct");
assert.equal(corrected.analysis.words[1]?.confidence, "high");
assert.equal(draftAnalysis.words[1]?.status, "substituted");

const belowThreshold = recomputeConfirmedReadingAnalysis({
  analysis: draftAnalysis,
  attemptedLevel: "story",
  durationSec: 20,
  overrides: [],
});

// correct + hesitation count as two read words; two errors yield 50% and a
// one-rung fallback from the attempted story passage.
assert.equal(belowThreshold.accuracyPct, 50);
assert.equal(belowThreshold.analysis.level, "paragraph");
assert.equal(belowThreshold.wcpm, 6);

assert.equal(
  confirmAssessmentRequestSchema.safeParse({
    overrides: [
      { heard_as: null, passage_word_index: 1, status: "correct" },
      { heard_as: null, passage_word_index: 1, status: "skipped" },
    ],
  }).success,
  false,
);

console.log("Confirmation contract passed: overrides, deterministic metrics, ladder fallback, and duplicate rejection.");
