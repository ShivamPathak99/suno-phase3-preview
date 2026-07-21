import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  createMathCheckDraft,
  isMathCheckDraft,
  mathInstrumentPassageId,
} from "@/lib/adaptive/math/check-contract";
import { createMathPracticePlan, storedMathFocus } from "@/lib/adaptive/math/focus";
import { generateProbeItems } from "@/lib/adaptive/math/item-generator";
import {
  isAuthenticationRequiredError,
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

export const runtime = "nodejs";

type StudentRecord = { id: string; name: string };
type InstrumentRecord = { id: string };
type MathSourceRecord = { analysis_json: unknown; teacher_confirmed: boolean };

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

export function createMathCheckStartHandler({
  createSupabaseClient = createUserScopedClient,
  createSeed = randomUUID,
  generateItems = generateProbeItems,
}: {
  createSupabaseClient?: () => UserScopedSupabaseClient | Promise<UserScopedSupabaseClient>;
  createSeed?: () => string;
  generateItems?: typeof generateProbeItems;
} = {}) {
  return async function POST(request: NextRequest) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const studentId =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as { studentId?: unknown }).studentId
        : undefined;
    if (!isUuid(studentId)) {
      return jsonError("studentId must be a UUID.", 400);
    }
    const sourceAssessmentId =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as { sourceAssessmentId?: unknown }).sourceAssessmentId
        : undefined;
    if (sourceAssessmentId !== undefined && !isUuid(sourceAssessmentId)) {
      return jsonError("sourceAssessmentId must be a UUID when supplied.", 400);
    }

    try {
      const supabase = await createSupabaseClient();
      const [studentResult, instrumentResult] = await Promise.all([
        supabase.from("students").select("id, name").eq("id", studentId).maybeSingle<StudentRecord>(),
        supabase
          .from("passages")
          .select("id")
          .eq("id", mathInstrumentPassageId)
          .maybeSingle<InstrumentRecord>(),
      ]);

      if (studentResult.error || instrumentResult.error) {
        console.error("Math check source lookup failed.", studentResult.error ?? instrumentResult.error);
        return jsonError("Couldn't prepare the math check. Please try again.", 502);
      }

      if (!studentResult.data) {
        return jsonError("The selected student was not found.", 404);
      }

      if (!instrumentResult.data) {
        return jsonError("The math instrument is not seeded yet. Run the demo seed once.", 503);
      }

      const seed = createSeed();
      let purpose: "diagnostic" | "practice_check" = "diagnostic";
      let items = generateItems(seed);

      if (sourceAssessmentId) {
        const { data: source, error: sourceError } = await supabase
          .from("assessments")
          .select("analysis_json, teacher_confirmed")
          .eq("id", sourceAssessmentId)
          .eq("student_id", studentId)
          .maybeSingle<MathSourceRecord>();
        if (sourceError) {
          console.error("Math re-check source lookup failed.", sourceError);
          return jsonError("Couldn't prepare the math re-check. Please try again.", 502);
        }
        if (!source?.teacher_confirmed || !isMathCheckDraft(source.analysis_json)) {
          return jsonError("The source math check is not ready for a re-check.", 409);
        }
        const focus = storedMathFocus(source.analysis_json);
        if (!focus) {
          return jsonError("There is no confirmed math focus to re-check yet.", 409);
        }
        purpose = "practice_check";
        items = createMathPracticePlan({
          focusSkillId: focus.focusSkillId,
          sourceAssessmentId,
        }).recheckItems;
      }

      const analysis = createMathCheckDraft({ items, purpose, seed });
      const { data: draft, error: insertError } = await supabase
        .from("assessments")
        .insert({
          accuracy: null,
          analysis_json: analysis,
          audio_url: null,
          level: null,
          passage_id: mathInstrumentPassageId,
          student_id: studentId,
          teacher_confirmed: false,
          transcript_json: null,
          wcpm: null,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !draft?.id) {
        console.error("Math check draft insert failed.", insertError);
        return jsonError("Couldn't start the math check. Please try again.", 502);
      }

      return NextResponse.json(
        { assessmentId: draft.id, items, purpose, studentName: studentResult.data.name },
        { status: 201 },
      );
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        return jsonError("Signed out — sign back in before continuing.", 401);
      }
      console.error("Math check start route failed.", error);
      return jsonError("Couldn't start the math check. Please try again.", 502);
    }
  };
}

export const POST = createMathCheckStartHandler();
