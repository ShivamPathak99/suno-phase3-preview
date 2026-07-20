import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractSkillEvidence, type SkillEvidenceEvent } from "../src/lib/adaptive/evidence";
import { buildStudentProfile } from "../src/lib/adaptive/profile";
import type { PassageMeta } from "../src/lib/adaptive/passage-catalog";
import { chooseFocus } from "../src/lib/adaptive/selection";

type MayaFixture = {
  expected: {
    evidenceSummary: {
      errors: number;
      hesitations: number;
      opportunities: number;
      readings: number;
    };
    profileSnapshot: {
      accuracyCreditTotal: number;
      automaticityCreditTotal: number;
      distinctWords: number;
      effectiveEvidence: number;
      recentErrorEwma: number;
      separateDays: number;
      state: string;
    };
  };
  readings: Array<{
    assessmentId: string;
    occurredAt: string;
    purpose: "benchmark";
    teacherConfirmed: true;
    tokens: Array<{
      confidence: "high";
      controlledExemplar: true;
      heardAs?: string;
      index: number;
      normalizedText: string;
      outcome: "correct" | "hesitation" | "substituted";
      primarySkillId: "en.digraph.sh";
      teacherAction: "edited";
    }>;
  }>;
  student: { id: string };
};

const projectRoot = resolve(import.meta.dirname, "..");
const maya = JSON.parse(
  readFileSync(
    resolve(projectRoot, "src", "lib", "adaptive", "__fixtures__", "maya-evidence.json"),
    "utf8",
  ),
) as MayaFixture;

const mayaEvents = maya.readings.flatMap((reading) => {
  const passage: PassageMeta = {
    language: "en",
    level: "word",
    passageId: `passage-${reading.assessmentId}`,
    source: "baseline",
    tokens: reading.tokens.map(({ controlledExemplar, index, normalizedText, primarySkillId }) => ({
      controlledExemplar,
      index,
      normalizedText,
      primarySkillId,
      role: "target",
    })),
    version: 1,
  };

  return extractSkillEvidence({
    assessment: {
      assessmentId: reading.assessmentId,
      occurredAt: reading.occurredAt,
      purpose: reading.purpose,
      studentId: maya.student.id,
      teacherConfirmed: reading.teacherConfirmed,
    },
    passage,
    wordOutcomes: reading.tokens.map((token) => ({
      confidence: token.confidence,
      confirmation: token.teacherAction,
      heardAs: token.heardAs,
      outcome: token.outcome,
      passageWordIndex: token.index,
    })),
  }).events;
});

const mayaProfile = buildStudentProfile({
  asOf: "2026-07-09T09:00:00.000Z",
  events: mayaEvents,
  studentId: maya.student.id,
});
const sh = mayaProfile.skills["en.digraph.sh"];

assert.ok(
  Math.abs(sh.accuracy.alpha - 1 - maya.expected.profileSnapshot.accuracyCreditTotal) <
    0.000000001,
);
assert.ok(
  Math.abs(sh.automaticity.alpha - 1 - maya.expected.profileSnapshot.automaticityCreditTotal) <
    0.000000001,
);
assert.equal(sh.distinctWordCount, maya.expected.profileSnapshot.distinctWords);
assert.ok(
  Math.abs(sh.accuracy.nEffective - maya.expected.profileSnapshot.effectiveEvidence) < 0.000000001,
);
assert.equal(sh.distinctPracticeDays, maya.expected.profileSnapshot.separateDays);
assert.ok(
  Math.abs(sh.recentErrorEwma - maya.expected.profileSnapshot.recentErrorEwma) < 0.000000001,
);
assert.equal(sh.state, maya.expected.profileSnapshot.state);
assert.equal(sh.accuracy.beta, 3.7);
assert.ok(Math.abs(sh.accuracy.mean - 0.5375) < 0.000000001);
assert.ok(Math.abs(sh.accuracy.lcb90 - 0.3247675123) < 0.0000001);
assert.equal(sh.automaticity.beta, 4.6);
assert.ok(Math.abs(sh.automaticity.mean - 0.425) < 0.000000001);
assert.ok(Math.abs(sh.automaticity.lcb90 - 0.21408032) < 0.0000001);
assert.equal(
  mayaProfile.skills["en.digraph.ch"].state,
  "locked",
  "An unseen dependent skill stays locked until its prerequisites are secure.",
);
const mayaFocus = chooseFocus({
  evidenceSummaryBySkill: { "en.digraph.sh": maya.expected.evidenceSummary },
  profile: mayaProfile,
  scope: { level: "word", studentName: "Maya" },
});
assert.equal(mayaFocus.kind, "focused_card");
assert.equal(mayaFocus.skillId, "en.digraph.sh");

function directCorrectEvent(
  assessmentId: string,
  occurredAt: string,
  distinctWordKey: string,
  skillId: SkillEvidenceEvent["skillId"] = "en.cvc.short_a",
): SkillEvidenceEvent {
  return {
    accuracyCredit: 1,
    assessmentId,
    automaticityCredit: 1,
    directness: 1,
    distinctWordKey,
    occurredAt,
    outcome: "correct",
    purpose: "focused_readback",
    skillId,
    studentId: "mastery-student",
    teacherConfirmed: true,
    v: "adaptive-evidence.v1",
    weight: 1,
  };
}

const masteryEvents = Array.from({ length: 10 }, (_, index) =>
  directCorrectEvent(
    `mastery-${index + 1}`,
    index < 5 ? "2026-06-01T09:00:00.000Z" : "2026-06-02T09:00:00.000Z",
    ["cat", "map", "bag", "jam"][index % 4] ?? "cat",
  ),
);
const masteryProfile = buildStudentProfile({
  asOf: "2026-06-03T09:00:00.000Z",
  events: masteryEvents,
  studentId: "mastery-student",
});
assert.equal(masteryProfile.skills["en.cvc.short_a"].state, "mastered");

const reviewProfile = buildStudentProfile({
  asOf: "2026-06-23T09:00:00.000Z",
  events: masteryEvents,
  studentId: "mastery-student",
});
assert.equal(reviewProfile.skills["en.cvc.short_a"].state, "review_due");

const heldProfile = buildStudentProfile({
  asOf: "2026-06-03T09:00:00.000Z",
  events: masteryEvents,
  studentId: "mastery-student",
  teacherHoldSkillIds: ["en.cvc.short_a"],
});
assert.equal(heldProfile.skills["en.cvc.short_a"].state, "teacher_hold");

const activeProfile = buildStudentProfile({
  activeSkillIds: ["en.hfw.the"],
  asOf: "2026-06-03T09:00:00.000Z",
  events: [],
  studentId: "active-student",
});
assert.equal(activeProfile.skills["en.hfw.the"].state, "active");

const automaticityEvents = masteryEvents.map((event) => ({
  ...event,
  assessmentId: `automaticity-${event.assessmentId}`,
  automaticityCredit: undefined,
  skillId: "en.hfw.the" as const,
  studentId: "automaticity-student",
}));
const automaticityBlockedProfile = buildStudentProfile({
  asOf: "2026-06-03T09:00:00.000Z",
  events: automaticityEvents,
  studentId: "automaticity-student",
});
assert.equal(
  automaticityBlockedProfile.skills["en.hfw.the"].state,
  "new",
  "Automaticity skills need their separate fluency evidence before mastery.",
);

const automaticityProfile = buildStudentProfile({
  asOf: "2026-06-03T09:00:00.000Z",
  events: automaticityEvents.map((event) => ({ ...event, automaticityCredit: 1 })),
  studentId: "automaticity-student",
});
assert.equal(automaticityProfile.skills["en.hfw.the"].state, "mastered");

console.log(
  "P2-T5 profile tests passed: Maya snapshot, prerequisite gate, mastery, review, and teacher hold.",
);
