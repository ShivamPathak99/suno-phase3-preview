import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function main() { const [report, dashboard] = await Promise.all([readFile("src/app/student/[studentId]/report/page.tsx", "utf8"), readFile("src/components/classroom-dashboard.tsx", "utf8")]); assert.match(report, /Growing strengths/); assert.match(report, /One useful focus/); assert.match(report, /Try at home/); assert.match(report, /PrintReportButton/); assert.match(dashboard, /class-movement-banner/); assert.match(dashboard, /column-attention-chip/); console.log("P3-T15 parent report and class aggregate contract passed."); }
void main();
