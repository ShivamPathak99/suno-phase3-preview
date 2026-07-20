import assert from "node:assert/strict";

import { buildStudentProfile, type StudentProfile } from "../src/lib/adaptive/profile";
import { chooseFocus } from "../src/lib/adaptive/selection";

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    confirmedReadingCount: 2,
    skills: {
      "en.cvc.short_a": {
        accuracy: { alpha: 3, beta: 5, lcb90: 0.24, mean: 0.375, nEffective: 6 },
        automaticity: { alpha: 3, beta: 5, lcb90: 0.24, mean: 0.375, nEffective: 6 },
        distinctPracticeDays: 2,
        distinctWordCount: 4,
        id: "en.cvc.short_a",
        lastEvidenceAt: "2026-07-10T09:00:00.000Z",
        prerequisitesMet: true,
        recentErrorEwma: 0.5,
        state: "reinforce",
      },
      "en.cvc.short_i": {
        accuracy: { alpha: 7, beta: 1, lcb90: 0.74, mean: 0.875, nEffective: 6 },
        automaticity: { alpha: 7, beta: 1, lcb90: 0.74, mean: 0.875, nEffective: 6 },
        distinctPracticeDays: 2,
        distinctWordCount: 4,
        id: "en.cvc.short_i",
        lastEvidenceAt: "2026-07-10T09:00:00.000Z",
        prerequisitesMet: true,
        recentErrorEwma: 0.1,
        state: "active",
      },
      "en.digraph.ch": {
        accuracy: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        automaticity: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        distinctPracticeDays: 0,
        distinctWordCount: 0,
        id: "en.digraph.ch",
        prerequisitesMet: true,
        recentErrorEwma: 0,
        state: "new",
      },
      "en.digraph.sh": {
        accuracy: { alpha: 3.5, beta: 4.5, lcb90: 0.26, mean: 0.4375, nEffective: 6 },
        automaticity: { alpha: 3.5, beta: 4.5, lcb90: 0.26, mean: 0.4375, nEffective: 6 },
        distinctPracticeDays: 2,
        distinctWordCount: 4,
        id: "en.digraph.sh",
        lastEvidenceAt: "2026-07-10T09:00:00.000Z",
        prerequisitesMet: true,
        recentErrorEwma: 0.5,
        state: "reinforce",
      },
      "en.hfw.is": {
        accuracy: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        automaticity: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        distinctPracticeDays: 0,
        distinctWordCount: 0,
        id: "en.hfw.is",
        prerequisitesMet: true,
        recentErrorEwma: 0,
        state: "new",
      },
      "en.hfw.the": {
        accuracy: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        automaticity: { alpha: 1, beta: 1, lcb90: 0.13, mean: 0.5, nEffective: 0 },
        distinctPracticeDays: 0,
        distinctWordCount: 0,
        id: "en.hfw.the",
        prerequisitesMet: true,
        recentErrorEwma: 0,
        state: "new",
      },
    },
    studentId: "maya",
    ...overrides,
  };
}

const evidenceSummaryBySkill = {
  "en.cvc.short_a": { errors: 3, hesitations: 1, opportunities: 8, readings: 2 },
  "en.digraph.sh": { errors: 3, hesitations: 2, opportunities: 9, readings: 2 },
};

const algorithmic = chooseFocus({
  evidenceSummaryBySkill,
  profile: makeProfile(),
  scope: { level: "word", studentName: "Maya" },
});
assert.equal(algorithmic.kind, "focused_card");
assert.equal(algorithmic.skillId, "en.cvc.short_a");

const pinned = chooseFocus({
  evidenceSummaryBySkill,
  profile: makeProfile(),
  scope: { level: "word", studentName: "Maya" },
  teacherPin: "en.digraph.sh",
});
assert.equal(pinned.kind, "focused_card");
assert.equal(pinned.skillId, "en.digraph.sh");
assert.equal(pinned.source, "teacher_pin");

const heldProfile = makeProfile();
heldProfile.skills["en.digraph.sh"].state = "teacher_hold";
const held = chooseFocus({
  evidenceSummaryBySkill,
  profile: heldProfile,
  scope: { level: "word", studentName: "Maya" },
  teacherPin: "en.digraph.sh",
});
assert.notEqual(
  held.kind === "focused_card" ? held.skillId : undefined,
  "en.digraph.sh",
  "A hold must prevent a teacher pin from selecting that skill.",
);

const coldStart = chooseFocus({
  profile: makeProfile({ confirmedReadingCount: 1 }),
  scope: { level: "word", studentName: "Saira" },
});
assert.deepEqual(coldStart, {
  kind: "general_card",
  reason: "Suno is still learning about Saira — here's a solid word-level card.",
  source: "cold_start",
});

const strategyProfile = makeProfile();
strategyProfile.skills["en.cvc.short_a"].state = "teacher_hold";
const strategy = chooseFocus({
  evidenceSummaryBySkill,
  focusHistory: [
    { lcb90: 0.26, skillId: "en.digraph.sh" },
    { lcb90: 0.26, skillId: "en.digraph.sh" },
    { lcb90: 0.26, skillId: "en.digraph.sh" },
  ],
  profile: strategyProfile,
  scope: { level: "word", studentName: "Maya" },
});
assert.equal(strategy.kind, "teacher_strategy_needed");
assert.equal(strategy.skillId, "en.digraph.sh");

const newOnlyProfile = makeProfile();
newOnlyProfile.skills["en.cvc.short_a"].state = "mastered";
newOnlyProfile.skills["en.cvc.short_i"].state = "mastered";
newOnlyProfile.skills["en.digraph.sh"].state = "new";
newOnlyProfile.skills["en.digraph.ch"].state = "new";
const introduction = chooseFocus({
  profile: newOnlyProfile,
  scope: { level: "word", studentName: "Maya" },
});
assert.equal(introduction.kind, "focused_card");
assert.equal(introduction.source, "new_skill");
assert.equal(introduction.skillId, "en.digraph.ch", "New-skill ties must break lexically.");

const mayaProfile = buildStudentProfile({
  asOf: "2026-07-09T09:00:00.000Z",
  events: [
    {
      accuracyCredit: 0.1,
      assessmentId: "maya-one",
      automaticityCredit: 0,
      directness: 1,
      distinctWordKey: "ship",
      occurredAt: "2026-07-01T09:00:00.000Z",
      outcome: "substituted",
      purpose: "benchmark",
      skillId: "en.digraph.sh",
      studentId: "maya-fixture",
      teacherConfirmed: true,
      v: "adaptive-evidence.v1",
      weight: 1,
    },
    {
      accuracyCredit: 0.1,
      assessmentId: "maya-two",
      automaticityCredit: 0,
      directness: 1,
      distinctWordKey: "shop",
      occurredAt: "2026-07-08T09:00:00.000Z",
      outcome: "substituted",
      purpose: "benchmark",
      skillId: "en.digraph.sh",
      studentId: "maya-fixture",
      teacherConfirmed: true,
      v: "adaptive-evidence.v1",
      weight: 1,
    },
    {
      accuracyCredit: 0.1,
      assessmentId: "maya-two",
      automaticityCredit: 0,
      directness: 1,
      distinctWordKey: "fish",
      occurredAt: "2026-07-08T09:00:00.000Z",
      outcome: "substituted",
      purpose: "benchmark",
      skillId: "en.digraph.sh",
      studentId: "maya-fixture",
      teacherConfirmed: true,
      v: "adaptive-evidence.v1",
      weight: 1,
    },
  ],
  studentId: "maya-fixture",
});
const mayaFocus = chooseFocus({
  evidenceSummaryBySkill: {
    "en.digraph.sh": { errors: 3, hesitations: 2, opportunities: 9, readings: 2 },
  },
  profile: mayaProfile,
  scope: { level: "word", studentName: "Maya" },
});
assert.equal(mayaFocus.kind, "focused_card");
assert.equal(mayaFocus.skillId, "en.digraph.sh");
assert.equal(
  mayaFocus.reason,
  "3 substitutions and 2 hesitations across 9 chances in 2 readings.",
);

console.log(
  "P2-T6 selection tests passed: cold start, pin/hold, ranking, new skills, strategy, and Maya focus.",
);
