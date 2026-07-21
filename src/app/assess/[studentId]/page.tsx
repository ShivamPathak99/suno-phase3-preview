import { notFound } from "next/navigation";

import { AssessFlow } from "@/components/assess-flow";
import { ConfirmAssessment } from "@/components/confirm-assessment";
import { parseAssessDebugMode } from "@/lib/assess-debug";
import {
  getFocusPanelDebugRecommendation,
  parseFocusPanelDebugMode,
} from "@/lib/adaptive/focus-panel-fixtures";
import {
  loadLiveAssessmentContext,
  loadLiveDraftAssessment,
} from "@/lib/live-assessment-context";
import type { ReadingPurpose } from "@/lib/adaptive/types";
import {
  getMockAssessmentContext,
  mockEmptyStudent,
  mockReadingAnalysis,
} from "@/lib/mock-assessment";

export const dynamic = "force-dynamic";

type AssessPageProps = {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{
    assessmentId?: string | string[];
    debug?: string | string[];
    mock?: string | string[];
    passageOffset?: string | string[];
    passageId?: string | string[];
    purpose?: string | string[];
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

function parsePurpose(value: string | undefined): ReadingPurpose | null {
  if (value === undefined || value === "benchmark") {
    return "benchmark";
  }

  return value === "focused_readback" ? value : null;
}

function parsePassageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 24 ? parsed : 0;
}

/**
 * Gate 3: normal routes resolve a real student and UUID-backed passage on the
 * server. The explicit mock query remains only as a visual/debug fixture.
 */
export default async function AssessPage({ params, searchParams }: AssessPageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const debugMode = parseAssessDebugMode(singleValue(query.debug));
  const focusPanelDebugMode = parseFocusPanelDebugMode(singleValue(query.debug));

  if (singleValue(query.mock) === "confirm") {
    const mockContext = getMockAssessmentContext(studentId);
    const initialAdaptive = focusPanelDebugMode
      ? getFocusPanelDebugRecommendation(focusPanelDebugMode, mockContext.student.name)
      : undefined;

    return (
      <ConfirmAssessment
        analysis={mockReadingAnalysis}
        assessmentId={mockContext.assessmentId}
        context={mockContext}
        initialAdaptive={initialAdaptive}
        isMock
      />
    );
  }

  const requestedAssessmentId = singleValue(query.assessmentId);
  if (requestedAssessmentId !== undefined) {
    if (!isUuid(requestedAssessmentId)) {
      notFound();
    }

    const draft = await loadLiveDraftAssessment(studentId, requestedAssessmentId);

    if (!draft) {
      notFound();
    }

    return (
      <ConfirmAssessment
        analysis={draft.analysis}
        assessmentId={draft.assessmentId}
        context={draft.context}
      />
    );
  }

  const purpose = parsePurpose(singleValue(query.purpose));
  const passageOffset = parsePassageOffset(singleValue(query.passageOffset));
  const requestedPassageId = singleValue(query.passageId);

  if (!purpose || (purpose === "focused_readback" && !isUuid(requestedPassageId))) {
    notFound();
  }

  const context = await loadLiveAssessmentContext(studentId, {
    passageId: purpose === "focused_readback" ? requestedPassageId : undefined,
    passageOffset: purpose === "benchmark" ? passageOffset : undefined,
    purpose,
  });

  if (context) {
    return (
      <AssessFlow
        context={context}
        debugMode={debugMode}
        key={context.student.id + ":" + context.passage.id + ":" + (debugMode ?? "ready")}
      />
    );
  }

  // Retain the B-5 empty-class/debug fixture without making the ordinary
  // seeded classroom use mock passage IDs or mock analysis results.
  if (studentId === "mock-reader" || studentId === mockEmptyStudent.id) {
    const mockContext = getMockAssessmentContext(studentId);

    return (
      <AssessFlow
        context={mockContext}
        debugMode={debugMode}
        key={mockContext.student.id + ":mock:" + (debugMode ?? "ready")}
        mode="mock"
        mockAnalysis={mockReadingAnalysis}
      />
    );
  }

  notFound();
}
