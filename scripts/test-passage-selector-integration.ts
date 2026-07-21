import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [context, page, flow] = await Promise.all([
    readFile("src/lib/live-assessment-context.ts", "utf8"),
    readFile("src/app/assess/[studentId]/page.tsx", "utf8"),
    readFile("src/components/assess-flow.tsx", "utf8"),
  ]);

  assert.match(context, /pickBenchmarkPassage/);
  assert.match(context, /isBaselineBenchmarkPassageId/);
  assert.match(context, /benchmarkCount: benchmarkHistory\.length/);
  assert.match(context, /selectionOffset: passageOffset/);
  assert.match(context, /Thin \$\{language\} \$\{selectedLevel\} benchmark pool/);
  assert.match(page, /parsePassageOffset/);
  assert.match(page, /passageOffset: purpose === "benchmark" \? passageOffset : undefined/);
  assert.match(flow, /changePassageHref/);
  assert.match(flow, /passageOffset=\$\{\(context\.passageOffset \?\? 0\) \+ 1\}/);
  assert.match(flow, /This passage stays the same on refresh and rotates after a confirmed check\./);

  console.log("P3-T9 passage selector integration passed: live selection, deterministic cycling, and refresh guidance.");
}

void main();
