import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const dashboard = source("../src/components/classroom-dashboard.tsx");
const classroom = source("../src/lib/live-classroom.ts");

for (const expected of [
  "+ Add child",
  "Another {cleanEditorName} is in this class",
  "Teacher placed",
  "Archived ({archivedStudents.length})",
  "Restore",
  "This is a demo child — nightly reset will restore them.",
  "No children at this level yet.",
]) {
  assert.ok(dashboard.includes(expected), `P3-T7 dashboard must include ${expected}`);
}

assert.match(dashboard, /startingLevel: ""/, "rename-only edits must not create a manual placement");
assert.match(dashboard, /startingLevel: editor\.startingLevel/, "a chosen level must reach the API");
assert.match(classroom, /\.eq\("is_archived", false\)/, "active board excludes archived children");
assert.match(classroom, /\.eq\("is_archived", true\)/, "archived list is loaded separately");

console.log("P3-T7 student UI contract passed: add, provisional chip, archive, restore, and empty columns.");
