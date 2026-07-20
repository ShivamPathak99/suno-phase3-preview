import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  createMathCheckDraft,
  mathInstrumentPassageId,
} from "@/lib/adaptive/math/check-contract";
import { generateProbeItems } from "@/lib/adaptive/math/item-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StudentRecord = { id: string; name: string };
type InstrumentRecord = { id: string };

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function createMathCheckStartHandler({
  createAdminClient = createSupabaseAdminClient,
  createSeed = randomUUID,
  generateItems = generateProbeItems,
}: {
  createAdminClient?: typeof createSupabaseAdminClient;
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

    try {
      const supabase = createAdminClient();
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
      const items = generateItems(seed);
      const analysis = createMathCheckDraft({ items, seed });
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
        { assessmentId: draft.id, items, studentName: studentResult.data.name },
        { status: 201 },
      );
    } catch (error) {
      console.error("Math check start route failed.", error);
      return jsonError("Couldn't start the math check. Please try again.", 502);
    }
  };
}

export const POST = createMathCheckStartHandler();
