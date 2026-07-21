import { NextRequest, NextResponse } from "next/server";

import {
  TranscriptionRequestError,
  transcribePublicAudio,
} from "@/lib/transcribe-audio";
import { guardOpenAiRoute } from "@/lib/auth/openai-rate-limit";
import { guardTranscriptionForAnalysis } from "@/lib/transcription-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

type TranscribeRequest = {
  audioUrl?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await guardOpenAiRoute();

  if (guard.response) {
    return guard.response;
  }

  let body: TranscribeRequest;

  try {
    body = (await request.json()) as TranscribeRequest;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (typeof body.audioUrl !== "string" || body.audioUrl.trim().length === 0) {
    return jsonError("audioUrl is required.", 400);
  }

  try {
    const transcription = await transcribePublicAudio(body.audioUrl.trim());
    const guard = guardTranscriptionForAnalysis(transcription);

    if (guard.unassessable) {
      // Log only aggregate diagnostics: this helps distinguish microphone
      // capture from an over-strict guard without printing a child's words.
      console.info("Transcription rejected by the safety guard.", {
        durationSec: Number(transcription.durationSec.toFixed(2)),
        wordCount: transcription.words.filter((word) => word.word.trim().length > 0).length,
      });
      return NextResponse.json(guard);
    }

    return NextResponse.json(transcription);
  } catch (error) {
    if (error instanceof TranscriptionRequestError) {
      return jsonError(error.message, error.status);
    }

    console.error("Audio transcription route failed.", error);
    return jsonError("Couldn't transcribe the recording. Please try again.", 502);
  }
}
