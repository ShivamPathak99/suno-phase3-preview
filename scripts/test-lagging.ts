import assert from "node:assert/strict";

import { buildFeedbackSummary } from "../src/lib/analytics/lagging";
import { buildStudentProfile } from "../src/lib/adaptive/profile";
import type { SkillEvidenceEvent } from "../src/lib/adaptive/evidence";

function event(overrides: Partial<SkillEvidenceEvent> = {}): SkillEvidenceEvent {
  return {
    accuracyCredit: 0,
    assessmentId: "assessment-1",
    directness: 1,
    distinctWordKey: "ship",
    occurredAt: "2026-07-22T09:00:00.000Z",
    outcome: "substituted",
    purpose: "benchmark",
    skillId: "en.digraph.sh",
    studentId: "student-1",
    subject: "reading",
    teacherConfirmed: true,
    v: "adaptive-evidence.v1",
    weight: 1,
    ...overrides,
  };
}

const events = [
  event(),
  event({ assessmentId: "assessment-2", distinctWordKey: "shop", outcome: "hesitation" }),
  event({ assessmentId: "assessment-3", skillId: "en.cvc.short_a", distinctWordKey: "cat", accuracyCredit: 1, outcome: "correct" }),
];
const profile = buildStudentProfile({ asOf: "2026-07-22T10:00:00.000Z", events, studentId: "student-1" });
const summary = buildFeedbackSummary({
  profile,
  thisAssessmentEvents: events.slice(0, 2),
  untrackedMisses: 3,
});
assert.equal(summary.thisRead[0]?.skillName, "sh words");
assert.equal(summary.thisRead[0]?.count, 2);
assert.equal(summary.untrackedMisses, 3);
assert.ok(summary.cumulative.length > 0);
assert.ok(summary.strengths.length > 0);

const perfect = buildFeedbackSummary({
  profile,
  thisAssessmentEvents: [event({ accuracyCredit: 1, outcome: "correct" })],
});
assert.deepEqual(perfect.thisRead, [], "A perfect read must not invent a needs row.");

const thin = buildFeedbackSummary({
  profile: buildStudentProfile({ asOf: "2026-07-22T10:00:00.000Z", events: [], studentId: "student-1" }),
  thisAssessmentEvents: [],
});
assert.equal(thin.confidenceNote, "Early days — two more readings will sharpen this picture.");

console.log("P3-T11 lagging summary passed: misses, strengths, untracked words, perfect read, and thin evidence.");
