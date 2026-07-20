import { readingLevels } from "@/lib/analysisSchema";
import type { ReadingLevel } from "@/lib/assessment-types";
import {
  type DashboardStudent,
  type MockClassroom,
  type SuggestedGroup,
  type UnassessedStudent,
} from "@/lib/mock-dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StudentRecord = {
  id: string;
  name: string;
};

type ConfirmedAssessmentRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string;
  student_id: string;
};

function isReadingLevel(value: string): value is ReadingLevel {
  return (readingLevels as readonly string[]).includes(value);
}

function emptyLevelCounts() {
  return {
    letter: 0,
    paragraph: 0,
    story: 0,
    word: 0,
  } as Record<ReadingLevel, number>;
}

/**
 * Placement is strictly the benchmark model. Older assessment rows predate
 * `_adaptive.purpose`, so missing purpose remains a benchmark for backwards
 * compatibility; any explicit non-benchmark purpose is excluded.
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

export function buildLiveClassroom({
  confirmedAssessments,
  newlyConfirmedAssessmentId,
  students,
}: {
  confirmedAssessments: readonly ConfirmedAssessmentRecord[];
  newlyConfirmedAssessmentId?: string;
  students: readonly StudentRecord[];
}): MockClassroom {
  const latestByStudent = new Map<
    string,
    ConfirmedAssessmentRecord & { level: ReadingLevel }
  >();
  const assessmentCountByStudent = new Map<string, number>();

  for (const assessment of confirmedAssessments) {
    if (!isPlacementAssessment(assessment.analysis_json) || !isReadingLevel(assessment.level)) {
      continue;
    }

    const confirmedAssessment = { ...assessment, level: assessment.level };

    assessmentCountByStudent.set(
      assessment.student_id,
      (assessmentCountByStudent.get(assessment.student_id) ?? 0) + 1,
    );

    if (!latestByStudent.has(assessment.student_id)) {
      latestByStudent.set(assessment.student_id, confirmedAssessment);
    }
  }

  const dashboardStudents: DashboardStudent[] = [];
  const unassessedStudents: UnassessedStudent[] = [];

  for (const student of students) {
    const latestAssessment = latestByStudent.get(student.id);

    if (!latestAssessment) {
      unassessedStudents.push({ id: student.id, name: student.name });
      continue;
    }

    const isNewlyConfirmed = latestAssessment.id === newlyConfirmedAssessmentId;
    dashboardStudents.push({
      assessmentCount: assessmentCountByStudent.get(student.id) ?? 1,
      assessmentId: latestAssessment.id,
      id: student.id,
      isNewlyConfirmed,
      lastAssessedAt: latestAssessment.created_at,
      level: latestAssessment.level,
      name: student.name,
      trend: isNewlyConfirmed ? "up" : "baseline",
    });
  }

  const levelCounts = emptyLevelCounts();
  for (const student of dashboardStudents) {
    levelCounts[student.level] += 1;
  }

  const groups: SuggestedGroup[] = readingLevels
    .filter((level) => levelCounts[level] > 0)
    .map((level, index) => ({
      childCount: levelCounts[level],
      level,
      number: index + 1,
    }));
  const confirmedStudent = dashboardStudents.find((student) => student.isNewlyConfirmed) ?? null;

  return {
    confirmedStudent,
    groups,
    levelCounts,
    students: dashboardStudents,
    unassessedStudents,
  };
}

/**
 * Loads the persisted benchmark model for the classroom board. Practice and
 * diagnostic records are deliberately fetched only to be excluded by the
 * pure placement boundary above, guarding against a future query regression.
 */
export async function getLiveClassroom(
  newlyConfirmedAssessmentId?: string,
): Promise<MockClassroom> {
  const supabase = createSupabaseAdminClient();
  const [studentsResult, assessmentsResult] = await Promise.all([
    supabase.from("students").select("id, name").order("name", { ascending: true }),
    supabase
      .from("assessments")
      .select("id, student_id, level, created_at, analysis_json")
      .eq("teacher_confirmed", true)
      .order("created_at", { ascending: false }),
  ]);

  if (studentsResult.error || assessmentsResult.error) {
    console.error("Classroom dashboard lookup failed.", studentsResult.error ?? assessmentsResult.error);
    throw new Error("Couldn't load the classroom dashboard.");
  }

  const students = (studentsResult.data ?? []) as StudentRecord[];
  const confirmedAssessments = (assessmentsResult.data ?? []) as ConfirmedAssessmentRecord[];
  return buildLiveClassroom({
    confirmedAssessments,
    newlyConfirmedAssessmentId,
    students,
  });
}
