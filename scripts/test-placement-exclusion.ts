import assert from "node:assert/strict";

import { buildLiveClassroom } from "../src/lib/live-classroom";

const maya = { id: "10000000-0000-4000-8000-000000000001", name: "Maya" };
const baseline = {
  analysis_json: { v: "reading-analysis.v1" },
  created_at: "2026-07-01T09:00:00.000Z",
  id: "baseline-word",
  level: "word",
  student_id: maya.id,
};
const focusedReadback = {
  analysis_json: { _adaptive: { purpose: "focused_readback", v: "adaptive-evidence.v1" } },
  created_at: "2026-07-08T09:00:00.000Z",
  id: "practice-story",
  level: "story",
  student_id: maya.id,
};
const diagnostic = {
  analysis_json: { _adaptive: { purpose: "diagnostic" } },
  created_at: "2026-07-09T09:00:00.000Z",
  id: "diagnostic-letter",
  level: "letter",
  student_id: maya.id,
};
const mathCheck = {
  analysis_json: { v: "math-check.v1" },
  created_at: "2026-07-10T09:00:00.000Z",
  id: "math-check-paragraph",
  level: "paragraph",
  student_id: maya.id,
};

const classroom = buildLiveClassroom({
  confirmedAssessments: [mathCheck, diagnostic, focusedReadback, baseline],
  newlyConfirmedAssessmentId: focusedReadback.id,
  students: [maya],
});

assert.equal(classroom.students.length, 1);
assert.equal(classroom.students[0]?.level, "word");
assert.equal(classroom.students[0]?.assessmentCount, 1);
assert.equal(classroom.students[0]?.isNewlyConfirmed, false);
assert.equal(classroom.levelCounts.word, 1);
assert.equal(classroom.levelCounts.story, 0);
assert.equal(classroom.confirmedStudent, null);

console.log("P2-T13 placement exclusion passed: practice, diagnostic, and math checks cannot move a column.");
