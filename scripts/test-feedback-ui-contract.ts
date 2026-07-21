import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [component, route] = await Promise.all([
    readFile("src/components/confirm-assessment.tsx", "utf8"),
    readFile("src/app/api/assessments/[assessmentId]/confirm/route.ts", "utf8"),
  ]);
  assert.match(component, /What this read tells us/);
  assert.match(component, /Suno doesn&apos;t track yet/);
  assert.match(component, /<FocusPanel/);
  assert.match(route, /buildFeedbackSummary/);
  assert.match(route, /feedbackProfile/);
  assert.doesNotMatch(component, /lagging\.ts/);
  console.log("P3-T12 feedback UI contract passed: teacher-only feedback, untracked row, and shared profile source.");
}

void main();
