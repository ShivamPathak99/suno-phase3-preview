import { extname } from "node:path";

import { toStreamingFile } from "openai";

import { callOpenAI, createOpenAIClient } from "@/lib/openai";

const audioBucketPathPrefix = "/storage/v1/object/public/audio/";
const audioFetchTimeoutMs = 15_000;
const maxAudioBytes = 25 * 1024 * 1024;
const transcriptionModel = "whisper-1";

const supportedContentTypes = {
  ".flac": new Set(["audio/flac"]),
  ".m4a": new Set(["audio/mp4", "audio/m4a", "audio/x-m4a"]),
  ".mp3": new Set(["audio/mpeg", "audio/mp3"]),
  ".mp4": new Set(["audio/mp4", "video/mp4"]),
  ".mpeg": new Set(["audio/mpeg", "video/mpeg"]),
  ".mpga": new Set(["audio/mpeg"]),
  ".ogg": new Set(["application/ogg", "audio/ogg"]),
  ".wav": new Set(["audio/wav", "audio/wave", "audio/x-wav"]),
  ".webm": new Set(["audio/webm", "video/webm"]),
} as const;

type SupportedExtension = keyof typeof supportedContentTypes;

export type TimestampedWord = {
  end: number;
  start: number;
  word: string;
};

export type TimestampedTranscription = {
  durationSec: number;
  text: string;
  words: TimestampedWord[];
};

export class TranscriptionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normaliseContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function getAudioSource(audioUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be configured on the server.");
  }

  let source: URL;
  let supabase: URL;

  try {
    source = new URL(audioUrl);
    supabase = new URL(supabaseUrl);
  } catch {
    throw new TranscriptionRequestError("audioUrl must be a valid URL.", 400);
  }

  if (
    source.protocol !== "https:" ||
    source.origin !== supabase.origin ||
    !source.pathname.startsWith(audioBucketPathPrefix) ||
    source.username ||
    source.password ||
    source.hash
  ) {
    throw new TranscriptionRequestError(
      "audioUrl must reference a public file in the Suno audio bucket.",
      400,
    );
  }

  const pathParts = source.pathname.split("/");
  const fileName = pathParts[pathParts.length - 1] ?? "";
  const extension = extname(fileName).toLowerCase() as SupportedExtension;

  if (!supportedContentTypes[extension]) {
    throw new TranscriptionRequestError("Unsupported audio file format.", 400);
  }

  return { extension, fileName, url: source.toString() };
}

async function fetchAudio(audioUrl: string, extension: SupportedExtension, fileName: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), audioFetchTimeoutMs);

  try {
    const response = await fetch(audioUrl, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TranscriptionRequestError(
        "Couldn't retrieve the audio recording. Please upload it again.",
        502,
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    const declaredLength = contentLengthHeader ? Number(contentLengthHeader) : null;

    if (
      declaredLength !== null &&
      Number.isFinite(declaredLength) &&
      declaredLength > maxAudioBytes
    ) {
      throw new TranscriptionRequestError(
        "The audio recording is too large to transcribe.",
        413,
      );
    }

    const contentType = normaliseContentType(response.headers.get("content-type"));

    if (!supportedContentTypes[extension].has(contentType)) {
      throw new TranscriptionRequestError("Unsupported audio content type.", 415);
    }

    if (!response.body) {
      throw new TranscriptionRequestError(
        "Couldn't retrieve the audio recording. Please upload it again.",
        502,
      );
    }

    return toStreamingFile(response.body, fileName, { type: contentType });
  } catch (error) {
    if (error instanceof TranscriptionRequestError) {
      throw error;
    }

    throw new TranscriptionRequestError(
      "Couldn't retrieve the audio recording. Please upload it again.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Downloads an allowed public Supabase audio object, then returns the
 * timestamped Whisper transcript required by the assessment pipeline.
 */
export async function transcribePublicAudio(
  audioUrl: string,
): Promise<TimestampedTranscription> {
  const source = getAudioSource(audioUrl);
  const client = createOpenAIClient();
  const transcription = await callOpenAI(async () => {
    // A streaming body can only be consumed once, so each OpenAI retry starts
    // with a fresh download from the public Supabase object.
    const audioFile = await fetchAudio(source.url, source.extension, source.fileName);

    return client.audio.transcriptions.create({
      file: audioFile,
      model: transcriptionModel,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });
  });

  if (!Number.isFinite(transcription.duration) || transcription.duration < 0) {
    throw new Error("The transcription response did not include a valid duration.");
  }

  return {
    durationSec: transcription.duration,
    text: transcription.text,
    words: (transcription.words ?? []).map(({ end, start, word }) => ({
      end,
      start,
      word,
    })),
  };
}
