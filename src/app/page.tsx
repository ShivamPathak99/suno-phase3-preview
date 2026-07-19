import { ClassroomDashboard } from "@/components/classroom-dashboard";
import { readingLevels } from "@/lib/analysisSchema";
import { getMockClassroom, type MockConfirmation } from "@/lib/mock-dashboard";
import type { ReadingLevel } from "@/lib/mock-assessment";

type HomePageProps = {
  searchParams: Promise<{
    assessmentId?: string | string[];
    confirmed?: string | string[];
    level?: string | string[];
  }>;
};

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function isReadingLevel(value: string | undefined): value is ReadingLevel {
  return value !== undefined && (readingLevels as readonly string[]).includes(value);
}

function isUuid(value: string | undefined) {
  return (
    value !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  const query = await searchParams;
  const assessmentId = singleValue(query.assessmentId);
  const studentId = singleValue(query.confirmed);
  const level = singleValue(query.level);
  const confirmation: MockConfirmation | undefined = studentId && isReadingLevel(level)
    ? {
        assessmentId: isUuid(assessmentId) ? assessmentId : undefined,
        level,
        studentId,
      }
    : undefined;
  const classroom = getMockClassroom(confirmation);

  return <ClassroomDashboard {...classroom} />;
}
