import { NextRequest, NextResponse } from "next/server";

import {
  createAdaptiveConfirmation,
  parseAdaptiveAssessmentPayload,
  type AdaptiveAssessmentPayload,
} from "@/lib/adaptive/confirmation";
import { parseStoredAdaptiveWorksheet } from "@/lib/adaptive/card-view";
import { getCuratedCard, passageMetadataForCuratedCard } from "@/lib/adaptive/card-catalog";
import { getPassageMetadata, type PassageMeta } from "@/lib/adaptive/passage-catalog";
import type { ReadingPurpose } from "@/lib/adaptive/types";
import { analysisSchema, readingLevels, type ReadingAnalysis } from "@/lib/analysisSchema";
import {
  confirmedAnalysisToEvidenceWords,
  recomputeConfirmedReadingAnalysis,
} from "@/lib/assessment-confirmation";
import {
  confirmAssessmentRequestSchema,
  timestampedTranscriptSchema,
  type ConfirmAssessmentResponse,
} from "@/lib/assessment-contract";
import type { ReadingLevel } from "@/lib/assessment-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type DraftAssessmentRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  passage_id: string;
  student_id: string;
  teacher_confirmed: boolean;
  transcript_json: unknown;
};

type PassageRecord = {
  level: string;
};

type StudentRecord = {
  name: string;
};

type ConfirmedAssessmentHistoryRecord = {
  analysis_json: unknown;
};

type PracticeWorksheetRecord = {
  content_json: unknown;
};

type StoredAnalysis = {
  adaptive: AdaptiveAssessmentPayload | null;
  analysis: ReadingAnalysis;
  purpose: ReadingPurpose;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

function isReadingLevel(value: string): value is ReadingLevel {
  return (readingLevels as readonly string[]).includes(value);
}

function responseForAssessment(
  assessment: Pick<DraftAssessmentRecord, "id" | "student_id">,
  analysis: ReadingAnalysis,
  adaptive: AdaptiveAssessmentPayload | null = null,
) {
  const response: ConfirmAssessmentResponse = {
    assessment: {
      accuracy_pct: analysis.accuracy_pct,
      analysis,
      id: assessment.id,
      level: analysis.level,
      studentId: assessment.student_id,
      wcpm: analysis.wcpm,
    },
  };

  if (adaptive) {
    response.adaptive = adaptive.focus;
  }

  return NextResponse.json(response);
}

function parseStoredAnalysis(value: unknown): StoredAnalysis | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const { _adaptive, ...analysisValue } = value as Record<string, unknown>;
  const parsed = analysisSchema.safeParse(analysisValue);

  const purpose =
    typeof _adaptive === "object" &&
    _adaptive !== null &&
    !Array.isArray(_adaptive) &&
    (_adaptive as { purpose?: unknown }).purpose === "focused_readback"
      ? "focused_readback"
      : "benchmark";

  return parsed.success
    ? { adaptive: parseAdaptiveAssessmentPayload(_adaptive), analysis: parsed.data, purpose }
    : null;
}

function practicePassageMetadata(value: unknown, passageId: string): PassageMeta | null {
  const worksheet = parseStoredAdaptiveWorksheet(value);

  if (!worksheet || worksheet.adaptive.passageId !== passageId) {
    return null;
  }

  const card = getCuratedCard(worksheet.adaptive.cardId);

  return card && card.focusSkillId === worksheet.adaptive.focusSkillId
    ? passageMetadataForCuratedCard(card, passageId)
    : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  if (!isUuid(assessmentId)) {
    return jsonError("assessmentId must be a UUID.", 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const input = confirmAssessmentRequestSchema.safeParse(body);

  if (!input.success) {
    return jsonError("overrides must be a valid list of word edits.", 400);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: draft, error: draftError } = await supabase
      .from("assessments")
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed, created_at")
      .eq("id", assessmentId)
      .maybeSingle<DraftAssessmentRecord>();

    if (draftError) {
      console.error("Assessment draft lookup failed.", draftError);
      return jsonError("Couldn't load the assessment draft. Please try again.", 502);
    }

    if (!draft) {
      return jsonError("The assessment draft was not found.", 404);
    }

    const existingStoredAnalysis = parseStoredAnalysis(draft.analysis_json);

    if (!existingStoredAnalysis) {
      console.error("Assessment confirmation found an invalid stored analysis.", assessmentId);
      return jsonError("The saved assessment is invalid and cannot be confirmed.", 502);
    }

    // A second tap (or a retry after a dropped response) must never create a
    // second assessment or overwrite the teacher's first confirmed decision.
    if (draft.teacher_confirmed) {
      return responseForAssessment(
        draft,
        existingStoredAnalysis.analysis,
        existingStoredAnalysis.adaptive,
      );
    }

    if (
      input.data.overrides.some(
        (override) =>
          override.passage_word_index >= existingStoredAnalysis.analysis.words.length,
      )
    ) {
      return jsonError("An override refers to a word outside this passage.", 400);
    }

    const transcript = timestampedTranscriptSchema.safeParse(draft.transcript_json);

    if (!transcript.success) {
      console.error("Assessment confirmation found an invalid stored transcript.", assessmentId);
      return jsonError("The saved transcript is invalid and cannot be confirmed.", 502);
    }

    const [
      { data: passage, error: passageError },
      { data: student, error: studentError },
      { data: practiceWorksheet, error: practiceWorksheetError },
    ] = await Promise.all([
      supabase
        .from("passages")
        .select("level")
        .eq("id", draft.passage_id)
        .maybeSingle<PassageRecord>(),
      supabase
        .from("students")
        .select("name")
        .eq("id", draft.student_id)
        .maybeSingle<StudentRecord>(),
      existingStoredAnalysis.purpose === "focused_readback"
        ? supabase
            .from("worksheets")
            .select("content_json")
            .contains("content_json", { adaptive: { passageId: draft.passage_id } })
            .limit(1)
            .maybeSingle<PracticeWorksheetRecord>()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (passageError) {
      console.error("Assessment confirmation passage lookup failed.", passageError);
      return jsonError("Couldn't load the assessment passage. Please try again.", 502);
    }

    if (studentError) {
      console.error("Assessment confirmation student lookup failed.", studentError);
      return jsonError("Couldn't load the student. Please try again.", 502);
    }

    if (practiceWorksheetError) {
      console.error("Practice card lookup failed.", practiceWorksheetError);
      return jsonError("Couldn't load the practice card. Please try again.", 502);
    }

    if (!passage || !isReadingLevel(passage.level)) {
      return jsonError("The assessment passage was not found.", 404);
    }

    if (!student) {
      return jsonError("The assessment student was not found.", 404);
    }

    const passageMetadata =
      getPassageMetadata(draft.passage_id) ??
      practicePassageMetadata(practiceWorksheet?.content_json, draft.passage_id) ??
      undefined;

    if (existingStoredAnalysis.purpose === "focused_readback" && !passageMetadata) {
      console.error("Practice card metadata was unavailable.", assessmentId);
      return jsonError("This practice card is unavailable for confirmation. Please start it again.", 502);
    }

    const confirmed = recomputeConfirmedReadingAnalysis({
      analysis: existingStoredAnalysis.analysis,
      attemptedLevel: passage.level,
      durationSec: transcript.data.durationSec,
      overrides: input.data.overrides,
    });

    const { data: confirmedHistory, error: confirmedHistoryError } = await supabase
      .from("assessments")
      .select("analysis_json")
      .eq("student_id", draft.student_id)
      .eq("teacher_confirmed", true)
      .returns<ConfirmedAssessmentHistoryRecord[]>();

    if (confirmedHistoryError) {
      console.error("Assessment confirmation history lookup failed.", confirmedHistoryError);
      return jsonError("Couldn't confirm the assessment. Please try again.", 502);
    }

    const adaptive = createAdaptiveConfirmation({
      assessment: {
        assessmentId: draft.id,
        occurredAt: draft.created_at,
        purpose: existingStoredAnalysis.purpose,
        studentId: draft.student_id,
        teacherConfirmed: true,
      },
      confirmedReadingCount: (confirmedHistory ?? []).length + 1,
      historicalAdaptiveAssessments: (confirmedHistory ?? []).flatMap((record) => {
        const stored = parseStoredAnalysis(record.analysis_json);
        return stored?.adaptive ? [stored.adaptive] : [];
      }),
      passage: passageMetadata,
      scope: { level: confirmed.analysis.level, studentName: student.name },
      wordOutcomes: confirmedAnalysisToEvidenceWords(
        confirmed.analysis,
        input.data.overrides,
      ),
    });

    const { data: updatedDraft, error: updateError } = await supabase
      .from("assessments")
      .update({
        accuracy: confirmed.accuracyPct,
        analysis_json: { ...confirmed.analysis, _adaptive: adaptive },
        level: confirmed.analysis.level,
        teacher_confirmed: true,
        wcpm: confirmed.wcpm,
      })
      .eq("id", assessmentId)
      .eq("teacher_confirmed", false)
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed, created_at")
      .maybeSingle<DraftAssessmentRecord>();

    if (updateError) {
      console.error("Assessment confirmation update failed.", updateError);
      return jsonError("Couldn't confirm the assessment. Please try again.", 502);
    }

    if (updatedDraft) {
      return responseForAssessment(updatedDraft, confirmed.analysis, adaptive);
    }

    // A parallel request may have confirmed the draft immediately before this
    // update. Return that final record to make the endpoint idempotent.
    const { data: alreadyConfirmed, error: alreadyConfirmedError } = await supabase
      .from("assessments")
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed, created_at")
      .eq("id", assessmentId)
      .maybeSingle<DraftAssessmentRecord>();

    if (alreadyConfirmedError) {
      console.error("Assessment confirmation race lookup failed.", alreadyConfirmedError);
      return jsonError("Couldn't confirm the assessment. Please try again.", 502);
    }

    const alreadyConfirmedStoredAnalysis = alreadyConfirmed
      ? parseStoredAnalysis(alreadyConfirmed.analysis_json)
      : null;

    if (alreadyConfirmed?.teacher_confirmed && alreadyConfirmedStoredAnalysis) {
      return responseForAssessment(
        alreadyConfirmed,
        alreadyConfirmedStoredAnalysis.analysis,
        alreadyConfirmedStoredAnalysis.adaptive,
      );
    }

    return jsonError("Couldn't confirm the assessment. Please try again.", 502);
  } catch (error) {
    console.error("Assessment confirmation route failed.", error);
    return jsonError("Couldn't confirm the assessment. Please try again.", 502);
  }
}
