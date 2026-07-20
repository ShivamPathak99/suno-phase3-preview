import { notFound } from "next/navigation";

import { MathCheckReview } from "@/components/math-check-review";
import { loadLiveMathCheck } from "@/lib/live-math-check";

export const dynamic = "force-dynamic";

export default async function MathReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string; studentId: string }>;
}) {
  const { assessmentId, studentId } = await params;
  const review = await loadLiveMathCheck(studentId, assessmentId);
  if (!review || review.teacherConfirmed) {
    notFound();
  }

  return (
    <MathCheckReview
      assessmentId={review.assessmentId}
      check={review.check}
      studentId={review.student.id}
      studentName={review.student.name}
    />
  );
}
