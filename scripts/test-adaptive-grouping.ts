import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { chooseGroupFocus, type GroupStudentNeed } from "../src/lib/adaptive/grouping";

function fixture(name: string) {
  return JSON.parse(
    readFileSync(new URL(`../src/lib/adaptive/__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as { expected: Record<string, unknown>; level: "word" | "paragraph"; students: GroupStudentNeed[] };
}

const wordGroup = fixture("word-level-group.json");
const wordRecommendation = chooseGroupFocus({ level: wordGroup.level, students: wordGroup.students });
assert.equal(wordRecommendation.kind, "focused_card");
if (wordRecommendation.kind === "focused_card") {
  assert.equal(wordRecommendation.skillId, "en.cvc.short_a");
  assert.equal(wordRecommendation.affectedStudents, 6);
  assert.equal(wordRecommendation.coverage, 0.75);
  assert.equal(wordRecommendation.groupNeed, 0.48125);
  assert.equal(wordRecommendation.reviewDueStudents, 2);
}

const paragraphGroup = fixture("paragraph-mixed-group.json");
const paragraphRecommendation = chooseGroupFocus({
  level: paragraphGroup.level,
  students: paragraphGroup.students,
});
assert.deepEqual(paragraphRecommendation, {
  kind: "general_card",
  reason: "Mixed needs — use a general paragraph card.",
  reviewDueStudents: 0,
});

console.log("P2-T15 grouping passed: Word selects short-a; Paragraph honestly stays mixed.");
