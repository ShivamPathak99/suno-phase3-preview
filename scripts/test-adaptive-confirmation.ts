import assert from "node:assert/strict";

import { createAdaptiveConfirmation } from "../src/lib/adaptive/confirmation";
import type { ConfirmedAssessmentWord } from "../src/lib/adaptive/evidence";
import type { PassageMeta } from "../src/lib/adaptive/passage-catalog";

function controlledPassage(
  passageId: string,
  words: string[],
): PassageMeta {
  return {
    language: "en",
    level: "word",
    passageId,
    source: "baseline",
    tokens: words.map((normalizedText, index) => ({
      controlledExemplar: true,
      index,
      normalizedText,
      primarySkillId: "en.digraph.sh",
      role: "target",
    })),
    version: 1,
  };
}

function words(
  outcomes: Array<ConfirmedAssessmentWord["outcome"]>,
): ConfirmedAssessmentWord[] {
  return outcomes.map((outcome, passageWordIndex) => ({
    confidence: "high",
    confirmation: "edited",
    outcome,
    passageWordIndex,
  }));
}

const first = createAdaptiveConfirmation({
  assessment: {
    assessmentId: "maya-reading-1",
    occurredAt: "2026-07-01T09:00:00.000Z",
    purpose: "benchmark",
    studentId: "maya",
    teacherConfirmed: true,
  },
  confirmedReadingCount: 1,
  passage: controlledPassage("maya-passage-1", ["ship", "shop", "fish", "shell", "she"]),
  scope: { level: "word", studentName: "Maya" },
  wordOutcomes: words(["correct", "hesitation", "substituted", "correct", "hesitation"]),
});

assert.equal(first.evidence.length, 3, "The per-card evidence cap applies before profile rebuild.");
assert.equal(first.focus.kind, "general_card");
assert.equal(first.focus.source, "cold_start");

const second = createAdaptiveConfirmation({
  assessment: {
    assessmentId: "maya-reading-2",
    occurredAt: "2026-07-08T09:00:00.000Z",
    purpose: "benchmark",
    studentId: "maya",
    teacherConfirmed: true,
  },
  confirmedReadingCount: 2,
  historicalAdaptiveAssessments: [first],
  passage: controlledPassage("maya-passage-2", ["dish", "wish", "brush", "shut"]),
  scope: { level: "word", studentName: "Maya" },
  wordOutcomes: words(["correct", "substituted", "substituted", "correct"]),
});

assert.equal(second.evidence.length, 3);
assert.equal(second.focus.kind, "focused_card");
assert.equal(second.focus.skillId, "en.digraph.sh");
assert.equal(
  second.focus.reason,
  "3 substitutions and 2 hesitations across 9 chances in 2 readings.",
);
assert.deepEqual(second.evidenceSummaryBySkill["en.digraph.sh"], {
  errors: 2,
  hesitations: 0,
  opportunities: 4,
  readings: 1,
});

const replay = createAdaptiveConfirmation({
  assessment: {
    assessmentId: "maya-reading-2",
    occurredAt: "2026-07-08T09:00:00.000Z",
    purpose: "benchmark",
    studentId: "maya",
    teacherConfirmed: true,
  },
  confirmedReadingCount: 2,
  existingAdaptive: second,
  passage: controlledPassage("maya-passage-2", ["dish", "wish", "brush", "shut"]),
  scope: { level: "word", studentName: "Maya" },
  wordOutcomes: words(["correct", "substituted", "substituted", "correct"]),
});

assert.deepEqual(replay, second, "Confirmation replay must preserve the immutable evidence payload.");

console.log("P2-T7 adaptive confirmation passed: persisted evidence, Maya focus, and replay idempotence.");
