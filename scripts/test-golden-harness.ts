import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

import {
  evaluateGoldenOutcome,
  formatAnalysisErrors,
  goldenCaseSchema,
  goldenManifestSchema,
  requiredGoldenCaseIds,
} from "../src/lib/golden-set";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "sample-data", "golden-set.json");
const manifest = goldenManifestSchema.parse(
  JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
);

const adultFluent = manifest.cases.find((testCase) => testCase.id === "adult-fluent");
const childDecent = manifest.cases.find((testCase) => testCase.id === "child-decent");
const silence = manifest.cases.find((testCase) => testCase.id === "near-silent");
const scriptedErrors = manifest.cases.find((testCase) => testCase.id === "adult-scripted-errors");

assert.deepEqual(
  manifest.cases.map((testCase) => testCase.id).sort(),
  [...requiredGoldenCaseIds].sort(),
  "The required seven-case golden set must remain complete.",
);
assert.ok(adultFluent, "The adult fluent case is required.");
assert.ok(childDecent, "The child decent-reader case is required.");
assert.ok(silence, "The silent guard case is required.");
assert.ok(scriptedErrors, "The adult scripted-errors case is required.");
assert.equal(
  goldenCaseSchema.safeParse({
    ...adultFluent,
    file: { ...adultFluent.file, path: "golden/../outside.mp4" },
  }).success,
  false,
  "Golden fixture paths must reject traversal segments.",
);

const fluentAnalysis = {
  level: "story" as const,
  wcpm: 71.2,
  accuracy_pct: 98,
  words: [
    {
      passage_word: "On",
      status: "correct" as const,
      heard_as: null,
      confidence: "high" as const,
    },
    {
      passage_word: "a",
      status: "correct" as const,
      heard_as: null,
      confidence: "high" as const,
    },
  ],
  summary_for_teacher: "Fluent reading.",
  recommended_focus: "Continue story discussion.",
};

const fluentPass = evaluateGoldenOutcome(adultFluent.expected, {
  outcome: "assessment",
  analysis: fluentAnalysis,
});

assert.equal(fluentPass.verdict, "PASS");
assert.equal(formatAnalysisErrors(fluentAnalysis), "None");

const childReview = evaluateGoldenOutcome(childDecent.expected, {
  outcome: "assessment",
  analysis: fluentAnalysis,
});

assert.equal(childReview.verdict, "REVIEW");

const fluentFailure = evaluateGoldenOutcome(adultFluent.expected, {
  outcome: "assessment",
  analysis: { ...fluentAnalysis, accuracy_pct: 76, level: "paragraph" },
});

assert.equal(fluentFailure.verdict, "FAIL");
assert.equal(fluentFailure.failures.length, 2);

const silentPass = evaluateGoldenOutcome(silence.expected, {
  outcome: "unassessable",
  stage: "transcription",
  reason: "Couldn't hear the reading \u2014 try again closer to the child",
});

assert.equal(silentPass.verdict, "PASS");

const silentFailure = evaluateGoldenOutcome(silence.expected, {
  outcome: "unassessable",
  stage: "analysis",
  reason: "reading did not match the passage",
});

assert.equal(silentFailure.verdict, "FAIL");

assert.equal(
  goldenManifestSchema.safeParse({
    ...manifest,
    cases: manifest.cases.map((testCase) =>
      testCase.id === "adult-scripted-errors"
        ? {
            ...testCase,
            expected: { ...testCase.expected, expectedWordStatuses: undefined },
          }
        : testCase,
    ),
  }).success,
  false,
  "The scripted-errors fixture must keep explicit substitution, skip, and correct-word checks.",
);

console.log("A-6 golden harness contract tests passed.");
