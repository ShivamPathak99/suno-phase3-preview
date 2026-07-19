import { AssessFlow } from "@/components/assess-flow";
import { getMockAssessmentContext, mockReadingAnalysis } from "@/lib/mock-assessment";

type AssessPageProps = {
  params: Promise<{ studentId: string }>;
};

/**
 * B-1 is intentionally self-contained and mock-only. The Gate 3 swap will
 * replace this context with a live student/passage read and pipeline result.
 */
export default async function AssessPage({ params }: AssessPageProps) {
  const { studentId } = await params;
  const context = getMockAssessmentContext(studentId);

  return <AssessFlow context={context} mockAnalysis={mockReadingAnalysis} />;
}
