import { NextRequest, NextResponse } from "next/server";

import {
  completeMathCheck,
  isMathCheckDraft,
  type MathCheckAnswer,
} from "@/lib/adaptive/math/check-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DraftRecord = {
  analysis_json: unknown;
  id: string;
  student_id: string;
  teacher_confirmed: boolean;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function parseCompletionInput(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as { answers?: unknown; elapsedSec?: unknown; studentId?: unknown };
  if (
    typeof candidate.studentId !== "string" ||
    !isUuid(candidate.studentId) ||
    !Number.isFinite(candidate.elapsedSec) ||
    typeof candidate.elapsedSec !== "number" ||
    candidate.elapsedSec < 0 ||
    !Array.isArray(candidate.answers)
  ) {
    return null;
  }

  const answers = candidate.answers as MathCheckAnswer[];
  if (
    !answers.every(
      (answer) =>
        answer &&
        typeof answer.itemId === "string" &&
        Number.isInteger(answer.answer) &&
        answer.answer >= 0,
    )
  ) {
    return null;
  }

  return { answers, elapsedSec: candidate.elapsedSec, studentId: candidate.studentId };
}

export function createMathCheckCompletionHandler({
  createAdminClient = createSupabaseAdminClient,
}: {
  createAdminClient?: typeof createSupabaseAdminClient;
} = {}) {
  return async function POST(
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
    const input = parseCompletionInput(body);
    if (!input) {
      return jsonError("studentId, elapsedSec, and one integer answer per item are required.", 400);
    }

    try {
      const supabase = createAdminClient();
      const { data: draft, error: draftError } = await supabase
      .from("assessments")
      .select("id, student_id, analysis_json, teacher_confirmed")
      .eq("id", assessmentId)
      .eq("student_id", input.studentId)
      .maybeSingle<DraftRecord>();

      if (draftError) {
      console.error("Math check draft lookup failed.", draftError);
      return jsonError("Couldn't save the math check. Please try again.", 502);
      }
      if (!draft) {
      return jsonError("The math check was not found.", 404);
      }
      if (draft.teacher_confirmed) {
      return NextResponse.json({ assessmentId: draft.id, readyForReview: true });
      }
      if (!isMathCheckDraft(draft.analysis_json)) {
      return jsonError("The saved math check is invalid.", 502);
      }

      let completed;
      try {
        completed = completeMathCheck(draft.analysis_json, input);
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "The math answers are invalid.", 400);
      }

      const { data: updated, error: updateError } = await supabase
      .from("assessments")
      .update({ analysis_json: completed })
      .eq("id", assessmentId)
      .eq("teacher_confirmed", false)
      .select("id")
      .maybeSingle<{ id: string }>();

      if (updateError) {
      console.error("Math check completion update failed.", updateError);
      return jsonError("Couldn't save the math check. Please try again.", 502);
      }

      return NextResponse.json({ assessmentId: updated?.id ?? assessmentId, readyForReview: true });
    } catch (error) {
      console.error("Math check completion route failed.", error);
      return jsonError("Couldn't save the math check. Please try again.", 502);
    }
  }
}

export const POST = createMathCheckCompletionHandler();
