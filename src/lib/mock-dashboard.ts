import { readingLevels } from "@/lib/analysisSchema";
import {
  mockDraftAssessmentId,
  mockStudents,
  type ReadingLevel,
} from "@/lib/mock-assessment";

export type AssessmentTrend = "baseline" | "up";

export type DashboardStudent = {
  assessmentCount: number;
  assessmentId: string;
  id: string;
  isNewlyConfirmed: boolean;
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

export type MockClassroom = {
  confirmedStudent: DashboardStudent | null;
  groups: SuggestedGroup[];
  levelCounts: Record<ReadingLevel, number>;
  students: DashboardStudent[];
  unassessedStudents: DashboardStudent[];
};

export type MockConfirmation = {
  assessmentId?: string;
  level: ReadingLevel;
  studentId: string;
};

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
export function getMockClassroom(confirmation?: MockConfirmation): MockClassroom {
  let confirmedStudent: DashboardStudent | null = null;

  const students = mockStudents.map((student, index) => {
    const isNewlyConfirmed = confirmation?.studentId === student.id;
    const confirmedLevel = isNewlyConfirmed && confirmation ? confirmation.level : student.level;
    const dashboardStudent: DashboardStudent = {
      assessmentCount: isNewlyConfirmed ? 2 : 1,
      assessmentId:
        isNewlyConfirmed && confirmation
          ? confirmation.assessmentId ?? mockDraftAssessmentId(student.id)
          : assessmentId(index),
      id: student.id,
      isNewlyConfirmed,
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

  return { confirmedStudent, groups, levelCounts, students, unassessedStudents: [] };
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
