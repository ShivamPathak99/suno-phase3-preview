import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import OpenAI from "openai";

const supportedExtensions = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".ogg",
  ".wav",
  ".webm",
]);
const transcriptionModel = "whisper-1";

function usage() {
  console.log(
    "Usage: npm run risk-spike -- <audio-path> [--language <en|hi>]",
  );
}

function fail(message: string): never {
  console.error(`Risk spike failed: ${message}`);
  process.exit(1);
}

const [rawPath, ...flags] = process.argv.slice(2);

if (!rawPath || rawPath === "--help" || rawPath === "-h") {
  usage();
  process.exit(rawPath ? 0 : 1);
}

let language: string | undefined;

for (let index = 0; index < flags.length; index += 1) {
  const flag = flags[index];

  if (flag === "--language") {
    language = flags[index + 1];
    index += 1;
    continue;
  }

  fail(`Unknown argument: ${flag}`);
}

if (flags.includes("--language") && !language) {
  fail("--language requires a value such as en or hi.");
}

if (!process.env.OPENAI_API_KEY) {
  fail("OPENAI_API_KEY is missing from .env.local.");
}

const audioPath = resolve(rawPath);

if (!existsSync(audioPath)) {
  fail(`Audio file not found: ${audioPath}`);
}

const extension = extname(audioPath).toLowerCase();

if (!supportedExtensions.has(extension)) {
  fail(`Unsupported audio extension: ${extension || "(none)"}`);
}

const audioFile = statSync(audioPath);

if (audioFile.size === 0) {
  fail("Audio file is empty.");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 1,
  timeout: 30_000,
});

async function main() {
  const startedAt = performance.now();

  try {
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: transcriptionModel,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      ...(language ? { language } : {}),
    });

    const elapsedMs = Math.round(performance.now() - startedAt);
    const words = transcription.words ?? [];

    console.log(
      JSON.stringify(
        {
          source: basename(audioPath),
          model: transcriptionModel,
          requested_language: language ?? null,
          detected_language: transcription.language,
          duration_sec: transcription.duration,
          request_duration_ms: elapsedMs,
          text: transcription.text,
          words: words.map(({ word, start, end }) => ({ word, start, end })),
        },
        null,
        2,
      ),
    );

    if (words.length === 0) {
      console.error("Risk spike failed: the response contained no word timestamps.");
      process.exitCode = 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Risk spike failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
