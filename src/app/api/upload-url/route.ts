import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import { NextRequest, NextResponse } from "next/server";

import {
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

export const runtime = "nodejs";
export const maxDuration = 60;

const bucketId = "audio";

const supportedContentTypes = {
  ".webm": new Set(["audio/webm", "video/webm"]),
  ".mp4": new Set(["audio/mp4", "video/mp4"]),
} as const;

type UploadUrlRequest = {
  fileName?: unknown;
  contentType?: unknown;
};

type ParsedUploadRequest =
  | { ok: false; error: string }
  | {
      ok: true;
      contentType: string;
      extension: keyof typeof supportedContentTypes;
    };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normaliseContentType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function parseUploadRequest(body: UploadUrlRequest): ParsedUploadRequest {
  if (typeof body.fileName !== "string" || body.fileName.trim().length === 0) {
    return { ok: false, error: "fileName is required." };
  }

  if (typeof body.contentType !== "string") {
    return { ok: false, error: "contentType is required." };
  }

  const fileNameParts = body.fileName.trim().split(/[\\/]/);
  const baseName = fileNameParts[fileNameParts.length - 1] ?? "";
  const extension = extname(baseName).toLowerCase() as keyof typeof supportedContentTypes;
  const contentType = normaliseContentType(body.contentType);
  const allowedContentTypes = supportedContentTypes[extension];

  if (!allowedContentTypes) {
    return { ok: false, error: "Only WebM and MP4 audio recordings are supported." };
  }

  if (!allowedContentTypes.has(contentType)) {
    return {
      ok: false,
      error: "The recording file extension does not match its audio content type.",
    };
  }

  return { ok: true, contentType, extension };
}

export async function POST(request: NextRequest) {
  let supabase: UserScopedSupabaseClient;

  try {
    ({ supabase } = await requireUserScopedSupabase());
  } catch {
    return jsonError("Signed out — sign back in before continuing.", 401);
  }

  let body: UploadUrlRequest;

  try {
    body = (await request.json()) as UploadUrlRequest;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parsed = parseUploadRequest(body);

  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const datePrefix = new Date().toISOString().slice(0, 10);
  const path = `uploads/${datePrefix}/${randomUUID()}${parsed.extension}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketId)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("Unable to create an audio upload URL.", error);
      return jsonError("Unable to prepare the audio upload. Please try again.", 502);
    }

    const { data: publicUrl } = supabase.storage.from(bucketId).getPublicUrl(path);

    return NextResponse.json(
      {
        audioUrl: publicUrl.publicUrl,
        contentType: parsed.contentType,
        path,
        signedUrl: data.signedUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Audio upload URL route failed.", error);
    return jsonError("Unable to prepare the audio upload. Please try again.", 500);
  }
}
