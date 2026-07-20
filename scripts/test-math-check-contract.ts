import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isPlacementAssessment } from "../src/lib/live-classroom";
import {
  completeMathCheck,
  createMathCheckDraft,
  mathInstrumentPassageId,
} from "../src/lib/adaptive/math/check-contract";
import { generateProbeItems } from "../src/lib/adaptive/math/item-generator";

const items = generateProbeItems("math-check-contract");
const draft = createMathCheckDraft({ items, seed: "math-check-contract" });
assert.equal(draft.v, "math-check.v1");
assert.equal(draft.items.length, 8);
assert.equal(isPlacementAssessment(draft), false, "Math rows must never affect reading placement.");
assert.equal(mathInstrumentPassageId, "20000000-0000-4000-8000-000000000011");

const completed = completeMathCheck(draft, {
  answers: items.map((item) => ({ answer: item.answer, itemId: item.id })),
  elapsedSec: 42,
});
assert.equal(completed.answers.length, 8);
assert.equal(completed.elapsedSec, 42);

assert.throws(
  () => completeMathCheck(draft, { answers: [], elapsedSec: 42 }),
  /one answer for every generated item/,
);

const flowSource = readFileSync(new URL("../src/components/math-check-flow.tsx", import.meta.url), "utf8");
assert.match(flowSource, /math-number-pad/);
assert.match(flowSource, /aria-label="Number pad"/);

const styles = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
assert.match(styles, /\.math-number-key[\s\S]*min-height:\s*48px/);

console.log("P2-T20 math-check contract passed: sentinel storage, all eight answers, and child number pad.");
