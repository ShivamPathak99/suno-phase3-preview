import assert from "node:assert/strict";

import { buildStudentTimeline } from "../src/lib/analytics/student-timeline";

const studentId = "student-1";
const adaptive = (purpose: "benchmark" | "focused_readback") => ({
  candidateSignals: [],
  evidence: [],
  evidenceSummaryBySkill: {},
  focus: { kind: "general_card" as const, reason: "Keep reading widely.", source: "general" as const },
  purpose,
  v: "adaptive-evidence.v1" as const,
});
const timeline = buildStudentTimeline({
  assessments: [
    { accuracy: 70, analysis_json: { _adaptive: adaptive("benchmark") }, created_at: "2026-06-01T09:00:00.000Z", id: "a", level: "word", teacher_confirmed: true, wcpm: 18 },
    { accuracy: 100, analysis_json: { _adaptive: adaptive("focused_readback") }, created_at: "2026-06-02T09:00:00.000Z", id: "p", level: "story", teacher_confirmed: true, wcpm: 40 },
    { accuracy: 85, analysis_json: { _adaptive: adaptive("benchmark") }, created_at: "2026-06-03T09:00:00.000Z", id: "b", level: "paragraph", teacher_confirmed: true, wcpm: 26 },
  ],
  studentId,
});
assert.equal(timeline.trends.length, 2, "Practice reads must never plot as benchmark trends.");
assert.equal(timeline.practiceReadCount, 1);
assert.equal(timeline.latestLevel, "paragraph");
assert.equal(timeline.diary[0]?.purpose, "benchmark");

console.log("P3-T13 student timeline passed: benchmark-only trends, practice activity, diary, and latest level.");
