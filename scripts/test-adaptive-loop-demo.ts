import assert from "node:assert/strict";

import { buildLiveClassroom } from "../src/lib/live-classroom";
import {
  createMayaDemoLoop,
  demoAssessmentIds,
  demoStudentIds,
  mayaPrerequisiteHistory,
} from "./seed";

const mayaId = "10000000-0000-4000-8000-000000000011";
const loop = createMayaDemoLoop();
const baselineHistory = mayaPrerequisiteHistory();

assert.equal(loop.length, 2, "The seeded demonstration needs two Maya read-backs.");
assert.ok(loop.every((readback) => readback.adaptive.purpose === "focused_readback"));
assert.ok(loop[0]?.adaptive.focus.kind === "focused_card");
assert.notDeepEqual(
  loop[1]?.adaptive.focus,
  loop[0]?.adaptive.focus,
  "The second read-back must visibly change the recommendation.",
);
assert.ok(demoStudentIds.includes(mayaId));
assert.ok(loop.every((readback) => demoAssessmentIds.includes(readback.id)));

const classroom = buildLiveClassroom({
  confirmedAssessments: [
    ...baselineHistory.map((adaptive) => ({
      analysis_json: { v: "reading-analysis.v1", _adaptive: adaptive },
      created_at: adaptive.evidence[0]?.occurredAt ?? "2026-07-17T08:00:00.000Z",
      id: adaptive.evidence[0]?.assessmentId ?? "missing-baseline-id",
      level: "word",
      student_id: mayaId,
    })),
    ...loop.map((readback) => ({
      analysis_json: { ...readback.analysis, _adaptive: readback.adaptive },
      created_at: readback.createdAt,
      id: readback.id,
      level: readback.analysis.level,
      student_id: mayaId,
    })),
  ],
  newlyConfirmedAssessmentId: loop[1]?.id,
  students: [{ id: mayaId, name: "Maya" }],
});

assert.equal(classroom.students[0]?.level, "word");
assert.equal(classroom.students[0]?.assessmentCount, 2);
assert.equal(classroom.confirmedStudent, null);

console.log("P2-T14 loop demo passed: Maya's recommendation changes while her Word placement stays fixed.");
