import type { ReadingAnalysis } from "@/lib/analysisSchema";
import type { ConfirmedAssessmentWord } from "@/lib/adaptive/evidence";
import type { AssessmentWordOverride } from "@/lib/assessment-contract";
import type { ReadingLevel } from "@/lib/assessment-types";

const readingLevelOrder: ReadingLevel[] = ["letter", "word", "paragraph", "story"];
const passingAccuracyPct = 80;

type ConfirmationInputs = {
  analysis: ReadingAnalysis;
  attemptedLevel: ReadingLevel;
  durationSec: number;
  overrides: AssessmentWordOverride[];
  /** The last confirmed level when this attempt was an eligible step-up. */
  stepUpBaseLevel?: ReadingLevel;
};

export type ConfirmedReadingAnalysis = {
  accuracyPct: number;
  analysis: ReadingAnalysis;
  wcpm: number;
};

/**
 * Creates the evidence-facing words from the result the teacher actually
 * confirmed. This intentionally runs after recomputation: draft AI markings
 * are never treated as evidence on their own.
 */
export function confirmedAnalysisToEvidenceWords(
  analysis: ReadingAnalysis,
  overrides: readonly AssessmentWordOverride[],
): ConfirmedAssessmentWord[] {
  const overriddenIndexes = new Set(
    overrides.map((override) => override.passage_word_index),
  );

  return analysis.words.map((word, passageWordIndex) => ({
    confidence: word.confidence,
    confirmation: overriddenIndexes.has(passageWordIndex) ? "edited" : "accepted",
    heardAs: word.heard_as ?? undefined,
    outcome: word.status,
    passageWordIndex,
  }));
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function isCountedAsCorrect(status: ReadingAnalysis["words"][number]["status"]) {
  // A hesitation is a pause before a word that was ultimately read; it is a
  // fluency marker, not a decoding error.
  return status === "correct" || status === "hesitation";
}

function levelBelow(level: ReadingLevel) {
  const index = readingLevelOrder.indexOf(level);

  return readingLevelOrder[Math.max(0, index - 1)] ?? "letter";
}

function isImmediateStepUp(baseLevel: ReadingLevel, attemptedLevel: ReadingLevel) {
  const baseIndex = readingLevelOrder.indexOf(baseLevel);
  return readingLevelOrder[baseIndex + 1] === attemptedLevel;
}

/**
 * Teacher confirmation is the source of truth. The draft model result remains
 * useful for its word marks, while the final accuracy/WCPM and ladder position
 * are deterministically rebuilt from the teacher-adjusted words and timings.
 */
export function recomputeConfirmedReadingAnalysis({
  analysis,
  attemptedLevel,
  durationSec,
  overrides,
  stepUpBaseLevel,
}: ConfirmationInputs): ConfirmedReadingAnalysis {
  const overrideByIndex = new Map(
    overrides.map((override) => [override.passage_word_index, override]),
  );

  const words = analysis.words.map((word, index) => {
    const override = overrideByIndex.get(index);

    return override
      ? {
          ...word,
          confidence: "high" as const,
          heard_as: override.heard_as,
          status: override.status,
        }
      : word;
  });
  const correctWordCount = words.filter((word) => isCountedAsCorrect(word.status)).length;
  const accuracyPct = words.length === 0 ? 0 : roundToOneDecimal((correctWordCount / words.length) * 100);
  const wcpm = roundToOneDecimal((correctWordCount / Math.max(durationSec, 1)) * 60);
  const level =
    stepUpBaseLevel && isImmediateStepUp(stepUpBaseLevel, attemptedLevel)
      ? accuracyPct >= passingAccuracyPct
        ? attemptedLevel
        : stepUpBaseLevel
      : accuracyPct >= passingAccuracyPct
        ? attemptedLevel
        : levelBelow(attemptedLevel);

  return {
    accuracyPct,
    analysis: {
      ...analysis,
      accuracy_pct: accuracyPct,
      level,
      wcpm,
      words,
    },
    wcpm,
  };
}
