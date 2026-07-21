import { parseAdaptiveAssessmentPayload } from "@/lib/adaptive/confirmation";
import { buildStudentProfile } from "@/lib/adaptive/profile";
import type { ReadingLevel } from "@/lib/assessment-types";
import { isPlacementAssessment } from "@/lib/student-placement";

export type TimelineAssessment = {
  accuracy: number | null;
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string | null;
  teacher_confirmed: boolean;
  wcpm: number | null;
};

export type StudentTimeline = {
  diary: Array<{ date: string; id: string; level: ReadingLevel | null; purpose: "benchmark" | "focused_readback" }>;
  focusEpisodes: Array<{ date: string; reason: string; skillId?: string }>;
  latestLevel: ReadingLevel | null;
  practiceReadCount: number;
  profile: ReturnType<typeof buildStudentProfile>;
  trends: Array<{ accuracy: number; date: string; id: string; level: ReadingLevel; wcpm: number }>;
};

function isLevel(value: string | null): value is ReadingLevel {
  return value === "letter" || value === "word" || value === "paragraph" || value === "story";
}

function byDate(left: TimelineAssessment, right: TimelineAssessment) {
  return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
}

/** Pure timeline model: practice is visible as activity but never enters trends or ladder truth. */
export function buildStudentTimeline({
  assessments,
  studentId,
}: {
  assessments: readonly TimelineAssessment[];
  studentId: string;
}): StudentTimeline {
  const confirmed = assessments.filter((assessment) => assessment.teacher_confirmed).sort(byDate);
  const reading = confirmed
    .map((assessment) => ({ assessment, adaptive: parseAdaptiveAssessmentPayload(
      typeof assessment.analysis_json === "object" && assessment.analysis_json !== null
        ? (assessment.analysis_json as { _adaptive?: unknown })._adaptive
        : undefined,
    ) }))
    .filter(({ adaptive }) => adaptive !== null);
  const benchmark = reading.filter(({ assessment }) => isPlacementAssessment(assessment.analysis_json) && isLevel(assessment.level));
  const events = reading.flatMap(({ adaptive }) => adaptive?.evidence ?? []);
  const latestDate = confirmed[confirmed.length - 1]?.created_at ?? "1970-01-01T00:00:00.000Z";
  const profile = buildStudentProfile({
    asOf: latestDate,
    confirmedReadingCount: benchmark.length,
    events,
    studentId,
  });
  const trends = benchmark.slice(-12).map(({ assessment }) => ({
    accuracy: assessment.accuracy ?? 0,
    date: assessment.created_at,
    id: assessment.id,
    level: assessment.level as ReadingLevel,
    wcpm: assessment.wcpm ?? 0,
  }));

  return {
    diary: reading
      .map(({ assessment, adaptive }) => ({
        date: assessment.created_at,
        id: assessment.id,
        level: isLevel(assessment.level) ? assessment.level : null,
        purpose: (adaptive?.purpose === "focused_readback" ? "focused_readback" : "benchmark") as "benchmark" | "focused_readback",
      }))
      .reverse(),
    focusEpisodes: reading
      .filter(({ adaptive }) => adaptive?.focus.kind === "focused_card")
      .map(({ assessment, adaptive }) => ({
        date: assessment.created_at,
        reason: adaptive?.focus.reason ?? "",
        skillId: adaptive?.focus.kind === "focused_card" ? adaptive.focus.skillId : undefined,
      }))
      .reverse(),
    latestLevel: trends[trends.length - 1]?.level ?? null,
    practiceReadCount: reading.filter(({ adaptive }) => adaptive?.purpose === "focused_readback").length,
    profile,
    trends,
  };
}
