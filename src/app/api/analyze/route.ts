import { NextRequest, NextResponse } from "next/server";

import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/assessment-contract";
import { analyzeRequestSchema } from "@/lib/assessment-contract";
import { analyzeReading } from "@/lib/analyze-reading";
import { guardOpenAiRoute } from "@/lib/auth/openai-rate-limit";
import { guardTranscriptionForAnalysis } from "@/lib/transcription-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

type PassageRecord = {
  body: string;
  id: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function parseRequest(body: unknown): AnalyzeRequest | null {
  const parsed = analyzeRequestSchema.safeParse(body);

  return parsed.success ? parsed.data : null;
}

export async function POST(request: NextRequest) {
  const routeGuard = await guardOpenAiRoute();

  if (routeGuard.response) {
    return routeGuard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const input = parseRequest(body);

  if (!input) {
    return jsonError(
      "studentId, passageId, audioUrl, and a valid timestamped transcript are required.",
      400,
    );
  }

  const guard = guardTranscriptionForAnalysis(input.transcript);

  if (guard.unassessable) {
    return NextResponse.json(guard, { status: 422 });
  }

  try {
    const supabase = routeGuard.supabase;
    const [studentResult, passageResult] = await Promise.all([
      supabase.from("students").select("id").eq("id", input.studentId).maybeSingle(),
      supabase
        .from("passages")
        .select("id, body")
        .eq("id", input.passageId)
        .maybeSingle<PassageRecord>(),
    ]);

    if (studentResult.error || passageResult.error) {
      console.error("Assessment source lookup failed.", studentResult.error ?? passageResult.error);
      return jsonError("Couldn't load the selected student or passage. Please try again.", 502);
    }

    if (!studentResult.data) {
      return jsonError("The selected student was not found.", 404);
    }

    if (!passageResult.data || typeof passageResult.data.body !== "string") {
      return jsonError("The selected passage was not found.", 404);
    }

    const result = await analyzeReading(passageResult.data.body, input.transcript);

    if (result.analysis.accuracy_pct < 15 && input.transcript.words.length > 10) {
      return NextResponse.json(
        { unassessable: true, reason: "reading did not match the passage" },
        { status: 422 },
      );
    }

    const { data: draft, error: insertError } = await supabase
      .from("assessments")
      .insert({
        student_id: input.studentId,
        passage_id: input.passageId,
        audio_url: input.audioUrl,
        transcript_json: input.transcript,
        analysis_json: { ...result.analysis, _adaptive: { purpose: input.purpose } },
        level: result.analysis.level,
        wcpm: result.analysis.wcpm,
        accuracy: result.analysis.accuracy_pct,
        teacher_confirmed: false,
      })
      .select("id")
      .single();

    if (insertError || !draft || typeof draft.id !== "string") {
      console.error("Draft assessment insert failed.", insertError);
      return jsonError("Couldn't save the draft assessment. Please try again.", 502);
    }

    console.info(`Reading analysis completed with ${result.model}.`);

    const response: AnalyzeResponse = {
      assessmentId: draft.id,
      analysis: result.analysis,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Reading analysis route failed.", error);
    return jsonError("Couldn't analyze the reading. Please try again.", 502);
  }
}
