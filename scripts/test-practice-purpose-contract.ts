import assert from "node:assert/strict";

import { createAdaptiveConfirmation } from "../src/lib/adaptive/confirmation";
import { getCuratedCard, passageMetadataForCuratedCard } from "../src/lib/adaptive/card-catalog";
import { analyzeRequestSchema } from "../src/lib/assessment-contract";

const studentId = "10000000-0000-4000-8000-000000000001";
const passageId = "20000000-0000-4000-8000-000000000001";

const baseRequest = {
  audioUrl: "https://example.test/recording.webm",
  passageId,
  studentId,
  transcript: { durationSec: 8, text: "Shyam shops", words: [] },
};

assert.equal(analyzeRequestSchema.parse(baseRequest).purpose, "benchmark");
assert.equal(
  analyzeRequestSchema.parse({ ...baseRequest, purpose: "focused_readback" }).purpose,
  "focused_readback",
);

const card = getCuratedCard("en.digraph.sh.card1");
assert.ok(card, "The focused read-back test needs the reviewed Shyam card.");
const passage = passageMetadataForCuratedCard(card, passageId);
const adaptive = createAdaptiveConfirmation({
  assessment: {
    assessmentId: "30000000-0000-4000-8000-000000000001",
    occurredAt: "2026-07-21T10:00:00.000Z",
    purpose: "focused_readback",
    studentId,
    teacherConfirmed: true,
  },
  confirmedReadingCount: 2,
  passage,
  scope: { level: "word", studentName: "Maya" },
  wordOutcomes: passage.tokens
    .filter((token) => token.controlledExemplar)
    .map((token) => ({
      confidence: "high" as const,
      confirmation: "accepted" as const,
      outcome: "substituted" as const,
      passageWordIndex: token.index,
    })),
});

assert.equal(adaptive.purpose, "focused_readback");
assert.ok(adaptive.evidence.length > 0, "A confirmed practice card must produce direct evidence.");
assert.ok(
  adaptive.evidence.every((event) => event.purpose === "focused_readback"),
  "Every evidence event must retain its practice purpose.",
);

console.log("P2-T12 purpose contract passed: practice request, card evidence, and purpose persistence.");
