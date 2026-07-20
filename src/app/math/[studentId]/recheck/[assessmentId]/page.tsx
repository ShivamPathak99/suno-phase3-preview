import { notFound } from "next/navigation";

import { MathCheckFlow } from "@/components/math-check-flow";
import { storedMathFocus } from "@/lib/adaptive/math/focus";
import { loadLiveMathCheck } from "@/lib/live-math-check";

export const dynamic = "force-dynamic";

export default async function MathRecheckPage({
  params,
}: {
  params: Promise<{ assessmentId: string; studentId: string }>;
}) {
  const { assessmentId, studentId } = await params;
  const source = await loadLiveMathCheck(studentId, assessmentId);
  if (!source || !source.teacherConfirmed || !storedMathFocus(source.check)) {
    notFound();
  }

  return <MathCheckFlow sourceAssessmentId={assessmentId} studentId={studentId} />;
}
