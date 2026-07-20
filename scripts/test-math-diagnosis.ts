import assert from "node:assert/strict";

import arjunFixture from "../src/lib/adaptive/math/__fixtures__/arjun-diagnosis.json";
import { diagnoseMathResponses } from "../src/lib/adaptive/math/diagnosis";
import type { MathItem } from "../src/lib/adaptive/math/item-generator";

const arjun = diagnoseMathResponses({
  occurredAt: "2026-03-01T09:00:00.000Z",
  purpose: "diagnostic",
  responses: arjunFixture.responses as Array<{ answer: number; item: MathItem }>,
  studentId: arjunFixture.studentId,
});

const droppedCarry = arjun.bugs["add.dropped_carry"];
assert.equal(droppedCarry.confirmed, true);
assert.equal(droppedCarry.distinctItemIds.length, 3);
assert.equal(arjun.recommendation?.focusSkillId, "math.add.carry");
assert.equal(arjun.skillStates["math.add.carry"], "reinforce");
assert.match(arjun.recommendation?.reason ?? "", /dropped-carry answers across 3 different sums/);

const ambiguousItem: MathItem = {
  a: 40,
  answer: 33,
  b: 7,
  bugPredictions: {
    "sub.borrow_no_decrement": 43,
    "sub.smaller_from_larger": 47,
    "sub.zero_gives_zero": 33,
    "sub.zero_takes_n": 47
  },
  id: "ambiguous-zero",
  op: "-",
  skillId: "math.sub.borrow"
};
const ambiguous = diagnoseMathResponses({
  occurredAt: "2026-03-01T09:00:00.000Z",
  purpose: "diagnostic",
  responses: [{ answer: 47, item: ambiguousItem }],
  studentId: "demo-student-ambiguous",
});
assert.equal(ambiguous.bugs["sub.smaller_from_larger"].score, 0.425);
assert.equal(ambiguous.bugs["sub.zero_takes_n"].score, 0.425);

const duplicateItem = arjunFixture.responses[0]!.item as MathItem;
const duplicateOnly = diagnoseMathResponses({
  occurredAt: "2026-03-01T09:00:00.000Z",
  purpose: "diagnostic",
  responses: [
    { answer: 62, item: duplicateItem },
    { answer: 62, item: duplicateItem },
    { answer: 62, item: duplicateItem }
  ],
  studentId: "demo-student-duplicate",
});
assert.equal(duplicateOnly.bugs["add.dropped_carry"].confirmed, false);

console.log("P2-T19 diagnosis passed: split credit, distinct confirmation, and Arjun carry focus.");
