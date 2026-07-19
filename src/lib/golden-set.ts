import { z } from "zod";

import {
  analysisSchema,
  readingLevels,
  wordStatuses,
  type ReadingAnalysis,
} from "@/lib/analysisSchema";

export const requiredGoldenCaseIds = [
  "child-decent",
  "child-struggling",
  "child-noisy",
  "adult-fluent",
  "adult-scripted-errors",
  "near-silent",
  "wrong-passage",
] as const;

const uploadContentTypes = [
  "audio/mp4",
  "video/mp4",
  "audio/webm",
  "video/webm",
] as const;

const unassessableReasons = [
  "Couldn't hear the reading \u2014 try again closer to the child",
  "The reading was too fast to assess \u2014 please try again.",
  "reading did not match the passage",
] as const;

const expectedWordStatusSchema = z
  .object({
    passageWordIndex: z.number().int().nonnegative(),
    status: z.enum(wordStatuses),
  })
  .strict();

const assessmentExpectationSchema = z
  .object({
    outcome: z.literal("assessment"),
    expectedLevels: z.array(z.enum(readingLevels)).min(1).optional(),
    minAccuracyPct: z.number().min(0).max(100).optional(),
    maxErrorCount: z.number().int().nonnegative().optional(),
    minErrorCount: z.number().int().nonnegative().optional(),
    expectedWordStatuses: z.array(expectedWordStatusSchema).optional(),
    manualReviewRequired: z.boolean().optional(),
    notes: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minErrorCount !== undefined &&
      value.maxErrorCount !== undefined &&
      value.minErrorCount > value.maxErrorCount
    ) {
      context.addIssue({
        code: "custom",
        message: "minErrorCount cannot be greater than maxErrorCount.",
        path: ["minErrorCount"],
      });
    }
  });

const unassessableExpectationSchema = z
  .object({
    outcome: z.literal("unassessable"),
    stage: z.enum(["transcription", "analysis"]),
    reason: z.enum(unassessableReasons),
    notes: z.string().min(1),
  })
  .strict();

export const goldenExpectationSchema = z.discriminatedUnion("outcome", [
  assessmentExpectationSchema,
  unassessableExpectationSchema,
]);

const goldenFileSchema = z
  .object({
    path: z.string().regex(/^golden\/[A-Za-z0-9._/-]+\.(?:mp4|webm)$/u, {
      message: "Fixture paths must be a relative MP4 or WebM file under sample-data/golden/.",
    }),
    contentType: z.enum(uploadContentTypes),
  })
  .strict()
  .superRefine((value, context) => {
    const pathSegments = value.path.split("/");

    if (pathSegments.some((segment) => segment === "." || segment === "..")) {
      context.addIssue({
        code: "custom",
        message: "Fixture paths cannot contain . or .. segments.",
        path: ["path"],
      });
    }

    const isMp4 = value.path.toLowerCase().endsWith(".mp4");
    const isWebm = value.path.toLowerCase().endsWith(".webm");
    const matchesMp4 = isMp4 && (value.contentType === "audio/mp4" || value.contentType === "video/mp4");
    const matchesWebm =
      isWebm && (value.contentType === "audio/webm" || value.contentType === "video/webm");

    if (!matchesMp4 && !matchesWebm) {
      context.addIssue({
        code: "custom",
        message: "Fixture extension must match its declared contentType.",
        path: ["contentType"],
      });
    }
  });

export const goldenCaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/u),
    label: z.string().min(1),
    language: z.enum(["en", "hi"]),
    studentId: z.string().uuid(),
    passageId: z.string().uuid(),
    file: goldenFileSchema,
    expected: goldenExpectationSchema,
  })
  .strict();

function addDuplicateIdIssues(
  cases: Array<{ id: string }>,
  context: z.RefinementCtx,
  field: "cases" | "optionalCases",
) {
  const seen = new Set<string>();

  cases.forEach((testCase, index) => {
    if (seen.has(testCase.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate golden case id: ${testCase.id}.`,
        path: [field, index, "id"],
      });
    }

    seen.add(testCase.id);
  });
}

export const goldenManifestSchema = z
  .object({
    version: z.literal(1),
    cases: z.array(goldenCaseSchema).length(requiredGoldenCaseIds.length),
    optionalCases: z.array(goldenCaseSchema).default([]),
  })
  .strict()
  .superRefine((manifest, context) => {
    addDuplicateIdIssues(manifest.cases, context, "cases");
    addDuplicateIdIssues(manifest.optionalCases, context, "optionalCases");

    const actualIds = new Set(manifest.cases.map((testCase) => testCase.id));

    for (const id of requiredGoldenCaseIds) {
      if (!actualIds.has(id)) {
        context.addIssue({
          code: "custom",
          message: `The required golden case ${id} is missing.`,
          path: ["cases"],
        });
      }
    }

    for (const optionalCase of manifest.optionalCases) {
      if (actualIds.has(optionalCase.id)) {
        context.addIssue({
          code: "custom",
          message: `Optional case ${optionalCase.id} duplicates a required case.`,
          path: ["optionalCases"],
        });
      }
    }

    const scriptedErrorsCase = manifest.cases.find(
      (testCase) => testCase.id === "adult-scripted-errors",
    );

    if (
      !scriptedErrorsCase ||
      scriptedErrorsCase.expected.outcome !== "assessment" ||
      !scriptedErrorsCase.expected.expectedWordStatuses
    ) {
      context.addIssue({
        code: "custom",
        message:
          "adult-scripted-errors must declare expectedWordStatuses for its substitution, skip, self-correction, and repetition checks.",
        path: ["cases"],
      });
    } else {
      const statuses = new Set(
        scriptedErrorsCase.expected.expectedWordStatuses.map((word) => word.status),
      );

      for (const requiredStatus of ["substituted", "skipped", "correct"] as const) {
        if (!statuses.has(requiredStatus)) {
          context.addIssue({
            code: "custom",
            message: `adult-scripted-errors must include a ${requiredStatus} word expectation.`,
            path: ["cases"],
          });
        }
      }
    }
  });

export type GoldenCase = z.infer<typeof goldenCaseSchema>;
export type GoldenExpectation = z.infer<typeof goldenExpectationSchema>;
export type GoldenManifest = z.infer<typeof goldenManifestSchema>;

export type GoldenActualOutcome =
  | {
      outcome: "assessment";
      analysis: ReadingAnalysis;
    }
  | {
      outcome: "unassessable";
      reason: string;
      stage: "transcription" | "analysis";
    };

export type GoldenEvaluation = {
  failures: string[];
  notes: string[];
  verdict: "PASS" | "FAIL" | "REVIEW";
};

export function analysisErrors(analysis: ReadingAnalysis) {
  return analysis.words
    .map((word, index) => ({ ...word, passageWordIndex: index }))
    .filter((word) => word.status !== "correct");
}

export function formatAnalysisErrors(analysis: ReadingAnalysis, maximum = 3) {
  const errors = analysisErrors(analysis);

  if (errors.length === 0) {
    return "None";
  }

  const preview = errors.slice(0, maximum).map((word) => {
    const heardAs = word.heard_as ? ` -> ${word.heard_as}` : "";
    return `#${word.passageWordIndex + 1} ${word.passage_word}: ${word.status}${heardAs}`;
  });
  const remaining = errors.length - preview.length;

  return `${preview.join("; ")}${remaining > 0 ? `; +${remaining} more` : ""}`;
}

export function formatGoldenExpectation(expectation: GoldenExpectation) {
  if (expectation.outcome === "unassessable") {
    return `${expectation.stage} guard`;
  }

  if (expectation.expectedLevels) {
    return expectation.expectedLevels.join("/");
  }

  return "assessment";
}

/**
 * Compares deterministic expectations only. Human-reader cases without a
 * deterministic threshold intentionally return REVIEW so prompt tuning stays
 * evidence-led rather than pretending a model score is ground truth.
 */
export function evaluateGoldenOutcome(
  expected: GoldenExpectation,
  actual: GoldenActualOutcome,
): GoldenEvaluation {
  const failures: string[] = [];
  const notes = [expected.notes];

  if (expected.outcome !== actual.outcome) {
    return {
      failures: [`Expected ${expected.outcome}, received ${actual.outcome}.`],
      notes,
      verdict: "FAIL",
    };
  }

  if (expected.outcome === "unassessable" && actual.outcome === "unassessable") {
    if (expected.stage !== actual.stage) {
      failures.push(`Expected ${expected.stage} guard, received ${actual.stage} guard.`);
    }

    if (expected.reason !== actual.reason) {
      failures.push(`Expected guard reason ${JSON.stringify(expected.reason)}.`);
    }

    return {
      failures,
      notes,
      verdict: failures.length > 0 ? "FAIL" : "PASS",
    };
  }

  if (expected.outcome === "assessment" && actual.outcome === "assessment") {
    const { analysis } = actual;
    const errors = analysisErrors(analysis);
    let hasDeterministicCheck = false;

    if (expected.expectedLevels) {
      hasDeterministicCheck = true;

      if (!expected.expectedLevels.includes(analysis.level)) {
        failures.push(
          `Expected level ${expected.expectedLevels.join("/")}, received ${analysis.level}.`,
        );
      }
    }

    if (expected.minAccuracyPct !== undefined) {
      hasDeterministicCheck = true;

      if (analysis.accuracy_pct < expected.minAccuracyPct) {
        failures.push(
          `Expected accuracy >= ${expected.minAccuracyPct}, received ${analysis.accuracy_pct}.`,
        );
      }
    }

    if (expected.minErrorCount !== undefined) {
      hasDeterministicCheck = true;

      if (errors.length < expected.minErrorCount) {
        failures.push(
          `Expected at least ${expected.minErrorCount} marked errors, received ${errors.length}.`,
        );
      }
    }

    if (expected.maxErrorCount !== undefined) {
      hasDeterministicCheck = true;

      if (errors.length > expected.maxErrorCount) {
        failures.push(
          `Expected at most ${expected.maxErrorCount} marked errors, received ${errors.length}.`,
        );
      }
    }

    if (expected.expectedWordStatuses) {
      hasDeterministicCheck = true;

      for (const expectedWordStatus of expected.expectedWordStatuses) {
        const actualWord = analysis.words[expectedWordStatus.passageWordIndex];

        if (!actualWord || actualWord.status !== expectedWordStatus.status) {
          failures.push(
            `Expected word #${expectedWordStatus.passageWordIndex + 1} to be ${expectedWordStatus.status}.`,
          );
        }
      }
    }

    if (expected.manualReviewRequired) {
      notes.push("Manual review is required before this case becomes a regression gate.");
    }

    return {
      failures,
      notes,
      verdict:
        failures.length > 0
          ? "FAIL"
          : hasDeterministicCheck && !expected.manualReviewRequired
            ? "PASS"
            : "REVIEW",
    };
  }

  return {
    failures: ["Could not compare the expected and actual golden outcomes."],
    notes,
    verdict: "FAIL",
  };
}

export function parseGoldenAnalysis(value: unknown) {
  return analysisSchema.safeParse(value);
}
