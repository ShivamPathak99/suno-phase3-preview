import { readingLevels } from "@/lib/analysisSchema";
import type { GroupRecommendation } from "@/lib/adaptive/grouping";
import {
  mockDraftAssessmentId,
  mockEmptyStudent,
  mockStudents,
  type ReadingLevel,
} from "@/lib/mock-assessment";

export type AssessmentTrend = "baseline" | "up";

export type DashboardStudent = {
  assessmentCount: number;
  assessmentId: string;
  id: string;
  isNewlyConfirmed: boolean;
  isTeacherPlaced: boolean;
  lastAssessedAt: string;
  level: ReadingLevel;
  name: string;
  trend: AssessmentTrend;
};

export type SuggestedGroup = {
  childCount: number;
  level: ReadingLevel;
  number: number;
};

export type UnassessedStudent = {
  id: string;
  name: string;
};

export type ArchivedStudent = {
  id: string;
  name: string;
};

export type MockClassroom = {
  archivedStudents: ArchivedStudent[];
  confirmedStudent: DashboardStudent | null;
  groupRecommendations: Partial<Record<ReadingLevel, GroupRecommendation>>;
  groups: SuggestedGroup[];
  levelCounts: Record<ReadingLevel, number>;
  movementCount: number;
  students: DashboardStudent[];
  unassessedStudents: UnassessedStudent[];
};

export type MockConfirmation = {
  assessmentId?: string;
  level: ReadingLevel;
  studentId: string;
};

export type MockDashboardDebug = "empty-student";

const seedDate = new Date(Date.UTC(2026, 6, 18, 8, 0, 0));
const mockConfirmationTimestamp = "2026-07-19T09:00:00.000Z";

function assessmentId(index: number) {
  return "30000000-0000-4000-8000-" + String(index + 1).padStart(12, "0");
}

function assessmentTimestamp(index: number) {
  const timestamp = new Date(seedDate);
  timestamp.setUTCMinutes(seedDate.getUTCMinutes() + index);
  return timestamp.toISOString();
}

function countLevels(students: DashboardStudent[]) {
  return readingLevels.reduce(
    (counts, level) => {
      counts[level] = students.filter((student) => student.level === level).length;
      return counts;
    },
    {
      letter: 0,
      paragraph: 0,
      story: 0,
      word: 0,
    } as Record<ReadingLevel, number>,
  );
}

/**
 * B-3 mirrors the C-2 seed identities and timestamps without querying
 * Supabase. Gate 3 can replace this fixture with each student's latest
 * confirmed assessment while leaving the dashboard component unchanged.
 */
export function getMockClassroom(
  confirmation?: MockConfirmation,
  debug?: MockDashboardDebug,
): MockClassroom {
  let confirmedStudent: DashboardStudent | null = null;
  const emptyStudentIsConfirmed = confirmation?.studentId === mockEmptyStudent.id;
  const assessedRoster = emptyStudentIsConfirmed ? [...mockStudents, mockEmptyStudent] : mockStudents;

  const students = assessedRoster.map((student, index) => {
    const isNewlyConfirmed = confirmation?.studentId === student.id;
    const confirmedLevel = isNewlyConfirmed && confirmation ? confirmation.level : student.level;
    const priorAssessmentCount = student.id === mockEmptyStudent.id ? 0 : 1;
    const dashboardStudent: DashboardStudent = {
      assessmentCount: isNewlyConfirmed ? priorAssessmentCount + 1 : priorAssessmentCount,
      assessmentId:
        isNewlyConfirmed && confirmation
          ? confirmation.assessmentId ?? mockDraftAssessmentId(student.id)
          : assessmentId(index),
      id: student.id,
      isNewlyConfirmed,
      isTeacherPlaced: false,
      lastAssessedAt: isNewlyConfirmed ? mockConfirmationTimestamp : assessmentTimestamp(index),
      level: confirmedLevel,
      name: student.name,
      trend: isNewlyConfirmed ? "up" : "baseline",
    };

    if (isNewlyConfirmed) {
      confirmedStudent = dashboardStudent;
    }

    return dashboardStudent;
  });
  const levelCounts = countLevels(students);
  const groups = readingLevels
    .filter((level) => levelCounts[level] > 0)
    .map((level, index) => ({
      childCount: levelCounts[level],
      level,
      number: index + 1,
    }));
  const unassessedStudents: UnassessedStudent[] =
    debug === "empty-student" && !emptyStudentIsConfirmed
      ? [{ id: mockEmptyStudent.id, name: mockEmptyStudent.name }]
      : [];

  return {
    archivedStudents: [],
    confirmedStudent,
    groupRecommendations: Object.fromEntries(
      groups.map((group) => [
        group.level,
        {
          kind: "general_card" as const,
          reason: `Mixed needs — use a general ${group.level} card.`,
          reviewDueStudents: 0,
        },
      ]),
    ),
    groups,
    levelCounts,
    movementCount: 0,
    students,
    unassessedStudents,
  };
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return value + "th";
  }

  if (value % 10 === 1) {
    return value + "st";
  }
  if (value % 10 === 2) {
    return value + "nd";
  }
  if (value % 10 === 3) {
    return value + "rd";
  }
  return value + "th";
}

export function assessmentCaption(student: DashboardStudent) {
  if (student.isTeacherPlaced) {
    return "Teacher placed · no reading yet";
  }

  if (student.isNewlyConfirmed) {
    return "Assessed just now · " + ordinal(student.assessmentCount) + " time";
  }

  const date = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(student.lastAssessedAt));

  return "Assessed " + date + " · " + ordinal(student.assessmentCount) + " time";
}
