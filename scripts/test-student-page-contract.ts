import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function main() { const page = await readFile("src/app/student/[studentId]/page.tsx", "utf8"); assert.match(page, /No benchmark readings yet/); assert.match(page, /Practice supports learning but never changes benchmark trends or placement/); assert.match(page, /Archived child — this history is read-only/); assert.match(page, /Reading diary/); console.log("P3-T14 student page contract passed: rich, thin, practice-only, and archived states."); }
void main();
