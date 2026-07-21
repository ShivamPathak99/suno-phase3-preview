import assert from "node:assert/strict";

import {
  resolveStudentPlacement,
  type PlacementAssessment,
  type PlacementStudent,
} from "../src/lib/student-placement";
import { parseCreateStudentInput, parsePatchStudentInput } from "../src/lib/student-contract";

const student: PlacementStudent = {
  id: "student-1",
  placement_source: "benchmark",
  teacher_placement_level: null,
};

const olderBenchmark: PlacementAssessment = {
  analysis_json: { level: "letter" },
  created_at: "2026-06-01T09:00:00.000Z",
  id: "assessment-old",
  level: "letter",
  student_id: student.id,
};

const newerBenchmark: PlacementAssessment = {
  analysis_json: { level: "word" },
  created_at: "2026-06-10T09:00:00.000Z",
  id: "assessment-new",
  level: "word",
  student_id: student.id,
};

const practiceRead: PlacementAssessment = {
  analysis_json: { _adaptive: { purpose: "focused_readback" }, level: "story" },
  created_at: "2026-06-15T09:00:00.000Z",
  id: "assessment-practice",
  level: "story",
  student_id: student.id,
};

assert.deepEqual(
  resolveStudentPlacement({
    confirmedAssessments: [olderBenchmark, practiceRead, newerBenchmark],
    student,
  }),
  {
    assessmentId: "assessment-new",
    kind: "benchmark",
    level: "word",
    occurredAt: "2026-06-10T09:00:00.000Z",
    source: "benchmark",
  },
  "latest confirmed benchmark wins and a practice read cannot move placement",
);

assert.deepEqual(
  resolveStudentPlacement({
    confirmedAssessments: [],
    student: { ...student, placement_source: "teacher", teacher_placement_level: "paragraph" },
  }),
  {
    assessmentId: null,
    kind: "teacher",
    level: "paragraph",
    occurredAt: null,
    source: "teacher",
  },
  "a new teacher estimate is a useful provisional placement",
);

assert.deepEqual(
  resolveStudentPlacement({
    confirmedAssessments: [newerBenchmark],
    student: { ...student, placement_source: "teacher", teacher_placement_level: "story" },
  }),
  {
    assessmentId: null,
    kind: "teacher",
    level: "story",
    occurredAt: null,
    source: "teacher",
  },
  "F2-E5: manual change after a benchmark re-provisionalizes the child",
);

assert.deepEqual(
  resolveStudentPlacement({ confirmedAssessments: [], student }),
  { assessmentId: null, kind: "unassessed", level: null, occurredAt: null, source: null },
  "a child with neither evidence nor teacher estimate is unassessed",
);

assert.deepEqual(parseCreateStudentInput({ name: "मीरा Patel", startingLevel: "word" }), {
  grade: null,
  name: "मीरा Patel",
  startingLevel: "word",
});
assert.equal(parseCreateStudentInput({ name: "🙂" }), null, "emoji names are rejected");
assert.deepEqual(parsePatchStudentInput({ startingLevel: "story" }), { startingLevel: "story" });

console.log("P3-T6 placement resolver passed: benchmark truth, teacher provisional override, and F2-E5.");
