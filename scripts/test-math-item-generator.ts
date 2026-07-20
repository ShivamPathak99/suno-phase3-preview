import assert from "node:assert/strict";

import { adaptiveConfig } from "../src/lib/adaptive/config";
import {
  assertMathItem,
  generateMathItem,
  generatePracticeSet,
  generateProbeItems,
  isMutuallyDistinguishing,
} from "../src/lib/adaptive/math/item-generator";
import { mathSkillIds } from "../src/lib/adaptive/math/skills-catalog";

for (const skillId of mathSkillIds) {
  for (let index = 0; index < adaptiveConfig.math.generator.propertyChecksPerSkill; index += 1) {
    assertMathItem(generateMathItem(skillId, `property:${skillId}`, index));
  }
}

const reproducibleItem = generateMathItem("math.add.carry", "fixed-seed", 4);
assert.deepEqual(reproducibleItem, generateMathItem("math.add.carry", "fixed-seed", 4));

const probe = generateProbeItems("probe-seed");
assert.equal(probe.length, adaptiveConfig.math.probe.itemCount);
assert.ok(
  probe.some((item) => item.skillId === "math.sub.no_borrow" && item.a === 30 && item.b === 0),
  "a probe must include the dedicated a−0 zero-bug template",
);
assert.ok(
  probe.some((item) => item.skillId === "math.sub.borrow" && item.a === 40 && item.b === 7),
  "a probe must include the dedicated x0−y zero-bug template",
);
assert.ok(
  probe.filter(isMutuallyDistinguishing).length >=
    adaptiveConfig.math.probe.minimumMutuallyDistinguishingItems,
  "each probe must include at least two mutually distinguishing items",
);

const practice = generatePracticeSet({
  focusSkillId: "math.add.carry",
  secureSkillIds: ["math.add.facts20", "math.add.no_carry", "math.sub.facts20"],
  seed: "practice-seed",
});
assert.equal(practice.length, adaptiveConfig.math.practice.totalItems);
assert.equal(
  practice.filter((item) => item.skillId === "math.add.carry").length,
  adaptiveConfig.math.practice.focusItems,
);
assert.equal(
  practice.filter((item) => item.skillId !== "math.add.carry").length,
  adaptiveConfig.math.practice.secureItems,
);

let consecutiveFocusItems = 0;
for (const item of practice) {
  consecutiveFocusItems = item.skillId === "math.add.carry" ? consecutiveFocusItems + 1 : 0;
  assert.ok(consecutiveFocusItems <= adaptiveConfig.math.practice.maximumConsecutiveFocusItems);
}

console.log("P2-T18 math generator passed: 6,000 constraints, probe distinction, and 7/3 practice.");
