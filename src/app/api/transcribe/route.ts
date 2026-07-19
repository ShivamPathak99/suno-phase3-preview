import { NextRequest, NextResponse } from "next/server";

import {
  TranscriptionRequestError,
  transcribePublicAudio,
} from "@/lib/transcribe-audio";

export const runtime = "nodejs";
export const maxDuration = 60;

type TranscribeRequest = {
  audioUrl?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
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

    return NextResponse.json(transcription);
  } catch (error) {
    if (error instanceof TranscriptionRequestError) {
      return jsonError(error.message, error.status);
    }

    console.error("Audio transcription route failed.", error);
    return jsonError("Couldn't transcribe the recording. Please try again.", 502);
  }
}
