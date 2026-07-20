import assert from "node:assert/strict";

import arjunFixture from "../src/lib/adaptive/math/__fixtures__/arjun-diagnosis.json";
import { completeMathCheck, createMathCheckDraft } from "../src/lib/adaptive/math/check-contract";
import { diagnoseMathResponses } from "../src/lib/adaptive/math/diagnosis";
import { buildReviewedMathResponses } from "../src/lib/adaptive/math/review";
import type { MathItem } from "../src/lib/adaptive/math/item-generator";

const items = arjunFixture.responses.map((response) => response.item) as MathItem[];
const completedDraft = completeMathCheck(
  createMathCheckDraft({ items, seed: "arjun-review" }),
  {
    answers: arjunFixture.responses.map((response) => ({ answer: response.answer, itemId: response.item.id })),
    elapsedSec: 20,
  },
);

const automatic = diagnoseMathResponses({
  occurredAt: "2026-03-01T09:00:00.000Z",
  purpose: "diagnostic",
  responses: buildReviewedMathResponses(completedDraft, []),
  studentId: arjunFixture.studentId,
});
assert.equal(automatic.bugs["add.dropped_carry"].confirmed, true);

const retaggedAsSlips = diagnoseMathResponses({
  occurredAt: "2026-03-01T09:00:00.000Z",
  purpose: "diagnostic",
  responses: buildReviewedMathResponses(
    completedDraft,
    items.map((item) => ({ itemId: item.id, reviewTag: "slip" })),
  ),
  studentId: arjunFixture.studentId,
});
assert.equal(retaggedAsSlips.bugs["add.dropped_carry"].score, 0);
assert.equal(retaggedAsSlips.bugs["add.dropped_carry"].confirmed, false);
assert.equal(retaggedAsSlips.evidence.length, 0);

assert.throws(
  () => buildReviewedMathResponses(completedDraft, [{ itemId: "unknown", reviewTag: "slip" }]),
  /does not belong to this math check/,
);

console.log("P2-T21 math review passed: automatic match, slip re-tag removal, and safe item validation.");
