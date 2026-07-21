import type { ReadingLevel } from "@/lib/assessment-types";

export const studentPlacementLevels = ["letter", "word", "paragraph", "story"] as const;

export type StudentPlacementLevel = (typeof studentPlacementLevels)[number];
export type StudentPlacementSource = "benchmark" | "teacher";

export type PlacementStudent = {
  id: string;
  placement_source?: string | null;
  teacher_placement_level?: string | null;
};

export type PlacementAssessment = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string | null;
  student_id: string;
};

export type ResolvedStudentPlacement =
  | {
      assessmentId: string;
      kind: "benchmark";
      level: ReadingLevel;
      occurredAt: string;
      source: "benchmark";
    }
  | {
      assessmentId: null;
      kind: "teacher";
      level: StudentPlacementLevel;
      occurredAt: null;
      source: "teacher";
    }
  | {
      assessmentId: null;
      kind: "unassessed";
      level: null;
      occurredAt: null;
      source: null;
    };

export function isStudentPlacementLevel(value: unknown): value is StudentPlacementLevel {
  return typeof value === "string" && (studentPlacementLevels as readonly string[]).includes(value);
}

/**
 * Placement is strictly the benchmark model. Older assessment rows predate
 * `_adaptive.purpose`, so missing purpose remains a benchmark; any explicit
 * non-benchmark purpose must never move a child between reading columns.
 */
export function isPlacementAssessment(analysisJson: unknown) {
  if (typeof analysisJson !== "object" || analysisJson === null || Array.isArray(analysisJson)) {
    return true;
  }

  const analysis = analysisJson as { _adaptive?: unknown; v?: unknown };

  if (analysis.v === "math-check.v1") {
    return false;
  }

  if (typeof analysis._adaptive !== "object" || analysis._adaptive === null) {
    return true;
  }

  const purpose = (analysis._adaptive as { purpose?: unknown }).purpose;
  return purpose === undefined || purpose === "benchmark";
}

function newestFirst(left: PlacementAssessment, right: PlacementAssessment) {
  const dateOrder = right.created_at.localeCompare(left.created_at);
  return dateOrder !== 0 ? dateOrder : right.id.localeCompare(left.id);
}

/**
 * The honest placement order is deliberately pure and shared by every reader
 * of the roster: a deliberate teacher override is provisional until the next
 * confirmed benchmark reclaims truth; otherwise the latest benchmark wins;
 * otherwise the child remains unassessed.
 */
export function resolveStudentPlacement({
  confirmedAssessments,
  student,
}: {
  confirmedAssessments: readonly PlacementAssessment[];
  student: PlacementStudent;
}): ResolvedStudentPlacement {
  // F2-E5: a manual change after a benchmark deliberately re-provisionalizes
  // the child. The confirmation route flips this source back to benchmark.
  if (
    student.placement_source === "teacher" &&
    isStudentPlacementLevel(student.teacher_placement_level)
  ) {
    return {
      assessmentId: null,
      kind: "teacher",
      level: student.teacher_placement_level,
      occurredAt: null,
      source: "teacher",
    };
  }

  const benchmark = [...confirmedAssessments]
    .filter(
      (assessment) =>
        assessment.student_id === student.id &&
        isStudentPlacementLevel(assessment.level) &&
        isPlacementAssessment(assessment.analysis_json),
    )
    .sort(newestFirst)[0];

  if (benchmark && isStudentPlacementLevel(benchmark.level)) {
    return {
      assessmentId: benchmark.id,
      kind: "benchmark",
      level: benchmark.level,
      occurredAt: benchmark.created_at,
      source: "benchmark",
    };
  }

  return { assessmentId: null, kind: "unassessed", level: null, occurredAt: null, source: null };
}
