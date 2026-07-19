import { readFileSync } from "node:fs";

import { readingLevels } from "../src/lib/analysisSchema";
import { isWorksheetLevel, worksheetPath } from "../src/lib/worksheet-route";

function verify(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

for (const level of readingLevels) {
  verify(isWorksheetLevel(level), `${level} must be a valid worksheet route level.`);
  verify(
    worksheetPath(level) === `/worksheet/${level}`,
    `${level} must resolve to its standalone worksheet route.`,
  );
}

verify(!isWorksheetLevel("not-a-level"), "Invalid worksheet levels must be rejected before generation.");

const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const worksheetStyles = stylesheet.slice(stylesheet.indexOf("/* C-5"));

for (const requiredToken of [
  "@page",
  "margin: 18mm",
  "size: A4",
  "@media print",
  ".worksheet-screen-chrome",
  "display: none !important",
  "#bbbbbb",
  "font-size: 22pt",
  "line-height: 1.8",
  "grid-template-columns: auto minmax(24mm, 1fr) auto minmax(24mm, 1fr)",
  "column-count: 2",
]) {
  verify(
    worksheetStyles.includes(requiredToken),
    `Worksheet print CSS must contain ${requiredToken}.`,
  );
}

verify(
  !/position:\s*fixed/u.test(worksheetStyles),
  "Worksheet route styles must not use fixed positioning in print layouts.",
);

console.log("Worksheet page contract passed: routes and A4 print CSS are intact.");
