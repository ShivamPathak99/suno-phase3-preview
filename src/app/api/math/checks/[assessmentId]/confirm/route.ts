import { NextRequest, NextResponse } from "next/server";

import { isMathCheckDraft } from "@/lib/adaptive/math/check-contract";
import { diagnoseMathResponses } from "@/lib/adaptive/math/diagnosis";
import { buildReviewedMathResponses, type MathReviewUpdate } from "@/lib/adaptive/math/review";
import {
  isAuthenticationRequiredError,
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

export const runtime = "nodejs";

type DraftRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  student_id: string;
  teacher_confirmed: boolean;
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function createUserScopedClient() {
  const { supabase } = await requireUserScopedSupabase();
  return supabase;
}

function parseReviewInput(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as { reviews?: unknown; studentId?: unknown };
  if (!isUuid(candidate.studentId) || !Array.isArray(candidate.reviews)) {
    return null;
  }
  if (
    !candidate.reviews.every(
      (review) =>
        review &&
        typeof review === "object" &&
        typeof (review as { itemId?: unknown }).itemId === "string" &&
        typeof (review as { reviewTag?: unknown }).reviewTag === "string",
    )
  ) {
    return null;
  }

  return {
    reviews: candidate.reviews as MathReviewUpdate[],
    studentId: candidate.studentId,
  };
}

export function createMathCheckConfirmHandler({
  createSupabaseClient = createUserScopedClient,
}: {
  createSupabaseClient?: () => UserScopedSupabaseClient | Promise<UserScopedSupabaseClient>;
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
    const input = parseReviewInput(body);
    if (!input) {
      return jsonError("studentId and valid review tags are required.", 400);
    }

    try {
      const supabase = await createSupabaseClient();
      const { data: draft, error: draftError } = await supabase
        .from("assessments")
        .select("id, student_id, analysis_json, teacher_confirmed, created_at")
        .eq("id", assessmentId)
        .eq("student_id", input.studentId)
        .maybeSingle<DraftRecord>();

      if (draftError) {
        console.error("Math review draft lookup failed.", draftError);
        return jsonError("Couldn't confirm the math check. Please try again.", 502);
      }
      if (!draft) {
        return jsonError("The math check was not found.", 404);
      }
      if (draft.teacher_confirmed) {
        return NextResponse.json({ assessmentId: draft.id, alreadyConfirmed: true });
      }
      if (!isMathCheckDraft(draft.analysis_json)) {
        return jsonError("The saved math check is invalid.", 502);
      }

      let diagnosis;
      try {
        diagnosis = diagnoseMathResponses({
          assessmentId: draft.id,
          occurredAt: draft.created_at,
          purpose: draft.analysis_json.purpose,
          responses: buildReviewedMathResponses(draft.analysis_json, input.reviews),
          studentId: draft.student_id,
        });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "The math review is invalid.", 400);
      }

      const confirmedAnalysis = {
        ...draft.analysis_json,
        _adaptive: {
          ...draft.analysis_json._adaptive,
          evidence: diagnosis.evidence,
          mathDiagnosis: {
            bugs: diagnosis.bugs,
            recommendation: diagnosis.recommendation ?? null,
            skillStates: diagnosis.skillStates,
          },
        },
      };
      const { data: updated, error: updateError } = await supabase
        .from("assessments")
        .update({ analysis_json: confirmedAnalysis, teacher_confirmed: true })
        .eq("id", draft.id)
        .eq("teacher_confirmed", false)
        .select("id")
        .maybeSingle<{ id: string }>();

      if (updateError) {
        console.error("Math review confirmation update failed.", updateError);
        return jsonError("Couldn't confirm the math check. Please try again.", 502);
      }

      return NextResponse.json({
        assessmentId: updated?.id ?? draft.id,
        diagnosis,
      });
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        return jsonError("Signed out — sign back in before continuing.", 401);
      }
      console.error("Math review confirmation route failed.", error);
      return jsonError("Couldn't confirm the math check. Please try again.", 502);
    }
  };
}

export const POST = createMathCheckConfirmHandler();
