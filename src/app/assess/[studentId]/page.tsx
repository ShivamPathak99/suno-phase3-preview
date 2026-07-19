import { AssessFlow } from "@/components/assess-flow";
import { ConfirmAssessment } from "@/components/confirm-assessment";
import { getMockAssessmentContext, mockReadingAnalysis } from "@/lib/mock-assessment";

type AssessPageProps = {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ mock?: string | string[] }>;
};

/**
 * B-1 is intentionally self-contained and mock-only. The Gate 3 swap will
 * replace this context with a live student/passage read and pipeline result.
 */
export default async function AssessPage({ params, searchParams }: AssessPageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const context = getMockAssessmentContext(studentId);

  /**
   * The direct-entry mock route keeps B-EC10 testable without relying on
   * browser-only B-1 state. Gate 3 will pass a real draft instead.
   */
  if (query.mock === "confirm") {
    return <ConfirmAssessment context={context} mockAnalysis={mockReadingAnalysis} />;
  }

  return <AssessFlow context={context} mockAnalysis={mockReadingAnalysis} />;
}
