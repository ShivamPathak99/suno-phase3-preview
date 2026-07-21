import type { ReadingAnalysis } from "@/lib/analysisSchema";
import type { ReadingLevel } from "@/lib/assessment-types";
import { isPlacementAssessment } from "@/lib/student-placement";

export const stepUpProbeConfig = {
  maximumHesitations: 1,
  promotionAccuracyPct: 80,
  qualifyingAccuracyPct: 90,
} as const;

const levelOrder: ReadingLevel[] = ["letter", "word", "paragraph", "story"];

export type StepUpHistoryAssessment = {
  accuracy: number | null;
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string | null;
  student_id: string;
};

export type StepUpStudent = {
  placement_source?: string | null;
  teacher_placement_level?: string | null;
};

export type StepUpProbe = {
  baseLevel: ReadingLevel;
  targetLevel: ReadingLevel;
};

function isReadingLevel(value: unknown): value is ReadingLevel {
  return typeof value === "string" && levelOrder.includes(value as ReadingLevel);
}

function latestFirst(left: StepUpHistoryAssessment, right: StepUpHistoryAssessment) {
  const dateOrder = right.created_at.localeCompare(left.created_at);
  return dateOrder !== 0 ? dateOrder : right.id.localeCompare(left.id);
}

function storedAnalysis(value: unknown): ReadingAnalysis | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const analysis = value as { accuracy_pct?: unknown; words?: unknown };
  if (typeof analysis.accuracy_pct !== "number" || !Array.isArray(analysis.words)) return null;
  return analysis as ReadingAnalysis;
}

export function nextReadingLevel(level: ReadingLevel) {
  const index = levelOrder.indexOf(level);
  return index >= 0 ? (levelOrder[index + 1] ?? null) : null;
}

export function getStepUpEligibility({
  confirmedAssessments,
  student,
}: {
  confirmedAssessments: readonly StepUpHistoryAssessment[];
  student: StepUpStudent;
}): StepUpProbe | null {
  // A teacher estimate can choose a passage, but never creates a promotion
  // probe; only a confirmed benchmark base can do that.
  if (student.placement_source === "teacher") return null;

  const latestBenchmark = [...confirmedAssessments]
    .filter((assessment) => isReadingLevel(assessment.level) && isPlacementAssessment(assessment.analysis_json))
    .sort(latestFirst)[0];
  if (!latestBenchmark || !isReadingLevel(latestBenchmark.level)) return null;

  const targetLevel = nextReadingLevel(latestBenchmark.level);
  if (!targetLevel) return null;

  const analysis = storedAnalysis(latestBenchmark.analysis_json);
  const accuracy = latestBenchmark.accuracy ?? analysis?.accuracy_pct ?? 0;
  const hesitationCount = analysis?.words.filter((word) => word.status === "hesitation").length ?? Infinity;

  return accuracy >= stepUpProbeConfig.qualifyingAccuracyPct && hesitationCount <= stepUpProbeConfig.maximumHesitations
    ? { baseLevel: latestBenchmark.level, targetLevel }
    : null;
}

export function isStepUpAttempt({
  attemptedLevel,
  confirmedAssessments,
  student,
}: {
  attemptedLevel: ReadingLevel;
  confirmedAssessments: readonly StepUpHistoryAssessment[];
  student: StepUpStudent;
}) {
  const eligibility = getStepUpEligibility({ confirmedAssessments, student });
  return eligibility?.targetLevel === attemptedLevel ? eligibility : null;
}
