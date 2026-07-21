import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  adaptivePracticePath,
  focusedReadNowPath,
  parseStoredAdaptiveWorksheet,
} from "../src/lib/adaptive/card-view";

const fixture = {
  adaptive: {
    cardId: "en.digraph.sh.card1",
    evidenceSummary: { errors: 3, hesitations: 2, opportunities: 9, readings: 2 },
    focusSkillId: "en.digraph.sh",
    mode: "individual",
    passageId: "passage-id",
    qualityChecks: { distinctTargets: 3, passed: true, targetCount: 4, wordCount: 31 },
    reason: "3 substitutions and 2 hesitations across 9 chances in 2 readings.",
    v: "adaptive-card.v1",
  },
  content: {
    body: "Shyam shops with a shiny shell.",
    question: "What does Shyam see?",
    title: "Shyam Shops",
    warmUpWords: ["ship", "shop", "fish"],
  },
  studentId: "10000000-0000-4000-8000-000000000001",
  tokens: [
    {
      controlledExemplar: true,
      index: 0,
      normalizedText: "shyam",
      primarySkillId: "en.digraph.sh",
      role: "target",
    },
  ],
  v: "adaptive-worksheet.v1",
};

const parsed = parseStoredAdaptiveWorksheet(fixture);
assert.ok(parsed, "P2-T10 adaptive worksheet JSON must load for the preview and child views.");
assert.equal(parsed.content.title, "Shyam Shops");
assert.equal(parseStoredAdaptiveWorksheet({ ...fixture, v: "worksheet.v1" }), null);
assert.equal(
  parseStoredAdaptiveWorksheet({ ...fixture, tokens: [{ ...fixture.tokens[0], role: "unexpected" }] }),
  null,
);
assert.equal(adaptivePracticePath("worksheet id"), "/practice/worksheet%20id");
assert.equal(adaptivePracticePath("worksheet id", "child"), "/practice/worksheet%20id?view=child");
assert.equal(
  focusedReadNowPath("student id", "passage id"),
  "/assess/student%20id?passageId=passage%20id&purpose=focused_readback",
);

const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const adaptiveStyles = stylesheet.slice(stylesheet.indexOf("/* P2-T11"));

function cssBlockAt(source: string, blockStart: number) {
  const openingBrace = source.indexOf("{", blockStart);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(blockStart, index + 1);
      }
    }
  }

  throw new Error("Adaptive card print CSS must have a complete @media print block.");
}
for (const requiredToken of [
  ".adaptive-card-screen-chrome",
  ".adaptive-card-target",
  "@media print",
  "padding: 18mm 16mm",
]) {
  assert.ok(adaptiveStyles.includes(requiredToken), `Adaptive card print CSS must contain ${requiredToken}.`);
}
const adaptivePrintStyles = cssBlockAt(
  adaptiveStyles,
  adaptiveStyles.indexOf("@media print"),
);

assert.equal(
  /position:\s*fixed/u.test(adaptivePrintStyles),
  false,
  "Adaptive card print layout must not use fixed positioning.",
);

console.log("P2-T11 adaptive card page contract passed: stored card parsing and child/read-now paths.");
