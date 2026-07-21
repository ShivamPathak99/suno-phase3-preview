import { ClassroomDashboard } from "@/components/classroom-dashboard";
import { getCurrentClassroom } from "@/lib/auth/classroom";
import { getLiveClassroom } from "@/lib/live-classroom";
import { getMockClassroom } from "@/lib/mock-dashboard";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    assessmentId?: string | string[];
    debug?: string | string[];
  }>;
};

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
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

  // Preserve the explicit B-5 empty-state fixture; all ordinary dashboard
  // routes now reflect the persisted teacher-confirmed assessment records.
  if (singleValue(query.debug) === "empty-student") {
    return <ClassroomDashboard {...getMockClassroom(undefined, "empty-student")} isDemoClassroom={false} />;
  }

  const currentClassroom = await getCurrentClassroom();
  const classroom = await getLiveClassroom(
    currentClassroom?.id ?? null,
    isUuid(assessmentId) ? assessmentId : undefined,
  );

  return <ClassroomDashboard {...classroom} isDemoClassroom={currentClassroom?.mode === "demo"} />;
}
