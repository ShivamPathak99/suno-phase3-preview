import assert from "node:assert/strict";

import { extractSkillEvidence } from "../src/lib/adaptive/evidence";
import type { PassageMeta } from "../src/lib/adaptive/passage-catalog";

const baseAssessment = {
  assessmentId: "assessment-1",
  occurredAt: "2026-07-10T09:00:00.000Z",
  purpose: "benchmark" as const,
  studentId: "student-1",
  teacherConfirmed: true,
};

function passage(tokens: PassageMeta["tokens"], source: PassageMeta["source"] = "focused_card") {
  return {
    language: "en",
    level: "word",
    passageId: "passage-1",
    source,
    tokens,
    version: 1,
  } satisfies PassageMeta;
}

const controlledShip = passage([
  {
    controlledExemplar: true,
    index: 0,
    normalizedText: "ship",
    primarySkillId: "en.digraph.sh",
    role: "target",
  },
]);

const acceptedCorrect = extractSkillEvidence({
  assessment: baseAssessment,
  passage: controlledShip,
  wordOutcomes: [
    {
      confidence: "high",
      confirmation: "accepted",
      outcome: "correct",
      passageWordIndex: 0,
    },
  ],
});
const teacherOverride = extractSkillEvidence({
  assessment: baseAssessment,
  passage: controlledShip,
  wordOutcomes: [
    {
      confidence: "high",
      confirmation: "edited",
      heardAs: "sip",
      outcome: "substituted",
      passageWordIndex: 0,
    },
  ],
});

assert.equal(acceptedCorrect.events.length, 1);
assert.equal(acceptedCorrect.events[0]?.accuracyCredit, 1);
assert.equal(acceptedCorrect.events[0]?.weight, 0.85);
assert.equal(teacherOverride.events.length, 1);
assert.equal(teacherOverride.events[0]?.accuracyCredit, 0.1);
assert.equal(teacherOverride.events[0]?.weight, 1);
assert.ok(
  (teacherOverride.events[0]?.accuracyCredit ?? 1) <
    (acceptedCorrect.events[0]?.accuracyCredit ?? 0),
  "An explicit teacher correction must replace the accepted AI signal.",
);
assert.deepEqual(
  teacherOverride.events.map((event) => event.skillId),
  ["en.digraph.sh"],
  "ship → sip must attribute evidence only to en.digraph.sh.",
);

for (const wordOutcome of [
  {
    confidence: "high" as const,
    confirmation: "edited" as const,
    outcome: "unclear" as const,
    passageWordIndex: 0,
  },
  {
    confidence: "low" as const,
    confirmation: "accepted" as const,
    outcome: "substituted" as const,
    passageWordIndex: 0,
  },
]) {
  const result = extractSkillEvidence({
    assessment: baseAssessment,
    passage: controlledShip,
    wordOutcomes: [wordOutcome],
  });
  assert.equal(result.events.length, 0, "Unclear and low-q outcomes must create no evidence.");
}

const repeatedShip = extractSkillEvidence({
  assessment: baseAssessment,
  passage: passage(
    Array.from({ length: 7 }, (_, index) => ({
      controlledExemplar: true,
      index,
      normalizedText: "ship",
      primarySkillId: "en.digraph.sh" as const,
      role: "target" as const,
    })),
  ),
  wordOutcomes: Array.from({ length: 7 }, (_, index) => ({
    confidence: "high" as const,
    confirmation: "edited" as const,
    outcome: "substituted" as const,
    passageWordIndex: index,
  })),
});

assert.equal(repeatedShip.events.length, 5, "Repeated words must stop at the effective cap.");
assert.equal(
  repeatedShip.events.reduce((total, event) => total + event.weight, 0),
  3,
  "A skill may contribute at most 3.0 effective evidence per card.",
);
assert.equal(repeatedShip.events[0]?.weight, 1);
assert.equal(repeatedShip.events[1]?.weight, 0.5);

const baselineCandidates = extractSkillEvidence({
  assessment: baseAssessment,
  passage: passage(
    [
      {
        controlledExemplar: false,
        index: 0,
        normalizedText: "ship",
        primarySkillId: "en.digraph.sh",
        role: "neutral",
      },
      {
        controlledExemplar: false,
        index: 1,
        normalizedText: "shell",
        primarySkillId: "en.digraph.sh",
        role: "neutral",
      },
    ],
    "baseline",
  ),
  wordOutcomes: [
    {
      confidence: "high",
      confirmation: "edited",
      outcome: "skipped",
      passageWordIndex: 0,
    },
    {
      confidence: "high",
      confirmation: "edited",
      outcome: "skipped",
      passageWordIndex: 1,
    },
  ],
});

assert.equal(baselineCandidates.events.length, 0, "Baseline non-controlled errors are not diagnosis.");
assert.deepEqual(baselineCandidates.candidateSignals, [
  {
    diagnosticEligible: true,
    distinctWordKeys: ["shell", "ship"],
    score: 1,
    skillId: "en.digraph.sh",
  },
]);

const replay = extractSkillEvidence({
  assessment: baseAssessment,
  existingEvidenceTokenIndexes: [0],
  passage: controlledShip,
  wordOutcomes: [
    {
      confidence: "high",
      confirmation: "edited",
      outcome: "substituted",
      passageWordIndex: 0,
    },
  ],
});

assert.deepEqual(replay, { candidateSignals: [], events: [] });

console.log(
  "P2-T4 evidence tests passed: confirmation reliability, direct attribution, caps, candidates, and replay safety.",
);
