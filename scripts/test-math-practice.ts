import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { adaptiveConfig } from "../src/lib/adaptive/config";
import { diagnoseMathResponses } from "../src/lib/adaptive/math/diagnosis";
import { createMathPracticePlan } from "../src/lib/adaptive/math/focus";

const plan = createMathPracticePlan({
  focusSkillId: "math.add.carry",
  sourceAssessmentId: "40000000-0000-4000-8000-000000000021",
});

assert.equal(plan.practiceItems.length, adaptiveConfig.math.practice.totalItems);
assert.equal(
  plan.practiceItems.filter((item) => item.skillId === "math.add.carry").length,
  adaptiveConfig.math.practice.focusItems,
);
assert.equal(plan.recheckItems.length, adaptiveConfig.math.recheck.totalItems);
assert.ok(
  plan.recheckItems.filter((item) => item.skillId === "math.add.carry").length >=
    adaptiveConfig.math.recheck.minimumFocusItems,
);

const postPractice = diagnoseMathResponses({
  occurredAt: "2026-03-02T09:00:00.000Z",
  purpose: "practice_check",
  responses: plan.recheckItems.map((item) => ({ answer: item.answer, item })),
  studentId: "demo-student-arjun",
});
assert.equal(postPractice.recommendation, undefined);
assert.equal(postPractice.skillStates["math.add.carry"], "growing");

const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
assert.match(stylesheet, /\.math-answer-key/);
assert.match(stylesheet, /break-before:\s*page/);

console.log("P2-T22 practice passed: 7/3 sheet, 4+ focus re-check, and updated recommendation.");
