import { readingLevels } from "@/lib/analysisSchema";
import { parseAdaptiveAssessmentPayload } from "@/lib/adaptive/confirmation";
import { chooseGroupFocus, type GroupStudentNeed } from "@/lib/adaptive/grouping";
import { buildStudentProfile } from "@/lib/adaptive/profile";
import { needForSkill } from "@/lib/adaptive/selection";
import { readingSkillCatalog } from "@/lib/adaptive/skills-catalog";
import type { ReadingLevel } from "@/lib/assessment-types";
import {
  isPlacementAssessment,
  resolveStudentPlacement,
} from "@/lib/student-placement";
import {
  type DashboardStudent,
  type MockClassroom,
  type SuggestedGroup,
  type UnassessedStudent,
} from "@/lib/mock-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudentRecord = {
  id: string;
  is_archived?: boolean | null;
  name: string;
  placement_source?: string | null;
  teacher_placement_level?: string | null;
};

type ConfirmedAssessmentRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string | null;
  student_id: string;
};

function emptyLevelCounts() {
  return {
    letter: 0,
    paragraph: 0,
    story: 0,
    word: 0,
  } as Record<ReadingLevel, number>;
}

export { isPlacementAssessment } from "@/lib/student-placement";

export function buildLiveClassroom({
  confirmedAssessments,
  newlyConfirmedAssessmentId,
  students,
}: {
  confirmedAssessments: readonly ConfirmedAssessmentRecord[];
  newlyConfirmedAssessmentId?: string;
  students: readonly StudentRecord[];
}): MockClassroom {
  const assessmentCountByStudent = new Map<string, number>();

  for (const assessment of confirmedAssessments) {
    if (!isPlacementAssessment(assessment.analysis_json) || assessment.level === null) {
      continue;
    }

    assessmentCountByStudent.set(
      assessment.student_id,
      (assessmentCountByStudent.get(assessment.student_id) ?? 0) + 1,
    );
  }

  const dashboardStudents: DashboardStudent[] = [];
  const unassessedStudents: UnassessedStudent[] = [];

  for (const student of students) {
    const placement = resolveStudentPlacement({ confirmedAssessments, student });

    if (placement.kind === "unassessed") {
      unassessedStudents.push({ id: student.id, name: student.name });
      continue;
    }

    const isNewlyConfirmed =
      placement.kind === "benchmark" && placement.assessmentId === newlyConfirmedAssessmentId;
    dashboardStudents.push({
      assessmentCount:
        placement.kind === "benchmark" ? (assessmentCountByStudent.get(student.id) ?? 1) : 0,
      assessmentId: placement.assessmentId ?? `teacher-placement:${student.id}`,
      id: student.id,
      isNewlyConfirmed,
      isTeacherPlaced: placement.kind === "teacher",
      lastAssessedAt: placement.occurredAt ?? "",
      level: placement.level,
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
  const groupRecommendations = {} as MockClassroom["groupRecommendations"];

  for (const group of groups) {
    const groupStudents: GroupStudentNeed[] = dashboardStudents
      .filter((student) => student.level === group.level)
      .map((student) => {
        const studentAssessments = confirmedAssessments.filter(
          (assessment) => assessment.student_id === student.id,
        );
        const adaptiveAssessments = studentAssessments.flatMap((assessment) => {
          const value =
            typeof assessment.analysis_json === "object" && assessment.analysis_json !== null
              ? (assessment.analysis_json as { _adaptive?: unknown })._adaptive
              : undefined;
          const adaptive = parseAdaptiveAssessmentPayload(value);
          return adaptive ? [adaptive] : [];
        });
        const events = adaptiveAssessments.flatMap((adaptive) => adaptive.evidence);
        const asOf = events.reduce(
          (latest, event) => (event.occurredAt > latest ? event.occurredAt : latest),
          student.lastAssessedAt,
        );
        const profile = buildStudentProfile({
          asOf,
          confirmedReadingCount: studentAssessments.length,
          events,
          studentId: student.id,
        });

        return {
          id: student.id,
          needBySkill: Object.fromEntries(
            readingSkillCatalog
              .filter((skill) => ["active", "reinforce", "review_due"].includes(profile.skills[skill.id].state))
              .map((skill) => [skill.id, needForSkill(profile.skills[skill.id])]),
          ) as GroupStudentNeed["needBySkill"],
          reviewDueSkillIds: readingSkillCatalog
            .filter((skill) => profile.skills[skill.id].state === "review_due")
            .map((skill) => skill.id),
        };
      });

    groupRecommendations[group.level] = chooseGroupFocus({
      level: group.level,
      students: groupStudents,
    });
  }

  return {
    confirmedStudent,
    groupRecommendations,
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
  classroomId: string | null,
  newlyConfirmedAssessmentId?: string,
): Promise<MockClassroom> {
  if (!classroomId) {
    return buildLiveClassroom({ confirmedAssessments: [], students: [] });
  }

  const supabase = await createSupabaseServerClient();
  const [studentsResult, assessmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, is_archived, placement_source, teacher_placement_level")
      .eq("classroom_id", classroomId)
      .eq("is_archived", false)
      .order("name", { ascending: true }),
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
