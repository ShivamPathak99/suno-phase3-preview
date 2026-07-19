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
 * Builds the heatmap from persisted, teacher-confirmed assessments. The
 * newest confirmed assessment wins placement while all confirmed attempts
 * remain counted on each student's card.
 */
export async function getLiveClassroom(
  newlyConfirmedAssessmentId?: string,
): Promise<MockClassroom> {
  const supabase = createSupabaseAdminClient();
  const [studentsResult, assessmentsResult] = await Promise.all([
    supabase.from("students").select("id, name").order("name", { ascending: true }),
    supabase
      .from("assessments")
      .select("id, student_id, level, created_at")
      .eq("teacher_confirmed", true)
      .order("created_at", { ascending: false }),
  ]);

  if (studentsResult.error || assessmentsResult.error) {
    console.error("Classroom dashboard lookup failed.", studentsResult.error ?? assessmentsResult.error);
    throw new Error("Couldn't load the classroom dashboard.");
  }

  const students = (studentsResult.data ?? []) as StudentRecord[];
  const confirmedAssessments = (assessmentsResult.data ?? []) as ConfirmedAssessmentRecord[];
  const latestByStudent = new Map<
    string,
    ConfirmedAssessmentRecord & { level: ReadingLevel }
  >();
  const assessmentCountByStudent = new Map<string, number>();

  for (const assessment of confirmedAssessments) {
    if (!isReadingLevel(assessment.level)) {
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
