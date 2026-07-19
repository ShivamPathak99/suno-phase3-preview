import { NextRequest, NextResponse } from "next/server";

import { analysisSchema, readingLevels, type ReadingAnalysis } from "@/lib/analysisSchema";
import { recomputeConfirmedReadingAnalysis } from "@/lib/assessment-confirmation";
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
  id: string;
  passage_id: string;
  student_id: string;
  teacher_confirmed: boolean;
  transcript_json: unknown;
};

type PassageRecord = {
  level: string;
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

  return NextResponse.json(response);
}

function parseStoredAnalysis(value: unknown) {
  const parsed = analysisSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
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
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed")
      .eq("id", assessmentId)
      .maybeSingle<DraftAssessmentRecord>();

    if (draftError) {
      console.error("Assessment draft lookup failed.", draftError);
      return jsonError("Couldn't load the assessment draft. Please try again.", 502);
    }

    if (!draft) {
      return jsonError("The assessment draft was not found.", 404);
    }

    const existingAnalysis = parseStoredAnalysis(draft.analysis_json);

    if (!existingAnalysis) {
      console.error("Assessment confirmation found an invalid stored analysis.", assessmentId);
      return jsonError("The saved assessment is invalid and cannot be confirmed.", 502);
    }

    // A second tap (or a retry after a dropped response) must never create a
    // second assessment or overwrite the teacher's first confirmed decision.
    if (draft.teacher_confirmed) {
      return responseForAssessment(draft, existingAnalysis);
    }

    if (
      input.data.overrides.some(
        (override) => override.passage_word_index >= existingAnalysis.words.length,
      )
    ) {
      return jsonError("An override refers to a word outside this passage.", 400);
    }

    const transcript = timestampedTranscriptSchema.safeParse(draft.transcript_json);

    if (!transcript.success) {
      console.error("Assessment confirmation found an invalid stored transcript.", assessmentId);
      return jsonError("The saved transcript is invalid and cannot be confirmed.", 502);
    }

    const { data: passage, error: passageError } = await supabase
      .from("passages")
      .select("level")
      .eq("id", draft.passage_id)
      .maybeSingle<PassageRecord>();

    if (passageError) {
      console.error("Assessment confirmation passage lookup failed.", passageError);
      return jsonError("Couldn't load the assessment passage. Please try again.", 502);
    }

    if (!passage || !isReadingLevel(passage.level)) {
      return jsonError("The assessment passage was not found.", 404);
    }

    const confirmed = recomputeConfirmedReadingAnalysis({
      analysis: existingAnalysis,
      attemptedLevel: passage.level,
      durationSec: transcript.data.durationSec,
      overrides: input.data.overrides,
    });

    const { data: updatedDraft, error: updateError } = await supabase
      .from("assessments")
      .update({
        accuracy: confirmed.accuracyPct,
        analysis_json: confirmed.analysis,
        level: confirmed.analysis.level,
        teacher_confirmed: true,
        wcpm: confirmed.wcpm,
      })
      .eq("id", assessmentId)
      .eq("teacher_confirmed", false)
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed")
      .maybeSingle<DraftAssessmentRecord>();

    if (updateError) {
      console.error("Assessment confirmation update failed.", updateError);
      return jsonError("Couldn't confirm the assessment. Please try again.", 502);
    }

    if (updatedDraft) {
      return responseForAssessment(updatedDraft, confirmed.analysis);
    }

    // A parallel request may have confirmed the draft immediately before this
    // update. Return that final record to make the endpoint idempotent.
    const { data: alreadyConfirmed, error: alreadyConfirmedError } = await supabase
      .from("assessments")
      .select("id, student_id, passage_id, transcript_json, analysis_json, teacher_confirmed")
      .eq("id", assessmentId)
      .maybeSingle<DraftAssessmentRecord>();

    if (alreadyConfirmedError) {
      console.error("Assessment confirmation race lookup failed.", alreadyConfirmedError);
      return jsonError("Couldn't confirm the assessment. Please try again.", 502);
    }

    const alreadyConfirmedAnalysis = alreadyConfirmed
      ? parseStoredAnalysis(alreadyConfirmed.analysis_json)
      : null;

    if (alreadyConfirmed?.teacher_confirmed && alreadyConfirmedAnalysis) {
      return responseForAssessment(alreadyConfirmed, alreadyConfirmedAnalysis);
    }

    return jsonError("Couldn't confirm the assessment. Please try again.", 502);
  } catch (error) {
    console.error("Assessment confirmation route failed.", error);
    return jsonError("Couldn't confirm the assessment. Please try again.", 502);
  }
}
