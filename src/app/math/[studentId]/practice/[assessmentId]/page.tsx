import { notFound } from "next/navigation";

import { MathPracticeSheet } from "@/components/math-practice-sheet";
import { createMathPracticePlan, storedMathFocus } from "@/lib/adaptive/math/focus";
import { loadLiveMathCheck } from "@/lib/live-math-check";

export const dynamic = "force-dynamic";

export default async function MathPracticePage({
  params,
}: {
  params: Promise<{ assessmentId: string; studentId: string }>;
}) {
  const { assessmentId, studentId } = await params;
  const source = await loadLiveMathCheck(studentId, assessmentId);
  const focus = source ? storedMathFocus(source.check) : null;
  if (!source || !source.teacherConfirmed || !focus) {
    notFound();
  }

  const plan = createMathPracticePlan({ focusSkillId: focus.focusSkillId, sourceAssessmentId: assessmentId });
  return (
    <MathPracticeSheet
      assessmentId={assessmentId}
      focus={focus}
      items={plan.practiceItems}
      studentId={studentId}
      studentName={source.student.name}
    />
  );
}
