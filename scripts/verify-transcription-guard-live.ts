import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.SUNO_APP_BASE_URL ?? "http://127.0.0.1:3001";

function fail(message: string): never {
  throw new Error(`A-4 live verification failed: ${message}`);
}

function makeSilentWav(durationSec: number) {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const audioDataBytes = sampleRate * durationSec * channels * bytesPerSample;
  const wav = Buffer.alloc(44 + audioDataBytes);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + audioDataBytes, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  wav.writeUInt16LE(channels * bytesPerSample, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(audioDataBytes, 40);

  return wav;
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const path = `verification/a4-silence-${randomUUID()}.wav`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(path, makeSilentWav(4), {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadError) {
      fail(`could not upload the generated silent WAV: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("audio").getPublicUrl(path);
    const response = await fetch(`${appBaseUrl}/api/transcribe`, {
      body: JSON.stringify({ audioUrl: publicUrlData.publicUrl }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload: unknown = await response.json();

    if (response.status !== 200 || !payload || typeof payload !== "object") {
      fail(
        `expected a 200 JSON response, received ${response.status}: ${JSON.stringify(payload)}`,
      );
    }

    const record = payload as Record<string, unknown>;
    const keys = Object.keys(record).sort();

    if (
      record.unassessable !== true ||
      record.reason !== "Couldn't hear the reading — try again closer to the child" ||
      keys.join(",") !== "reason,unassessable"
    ) {
      fail(`unexpected guard response: ${JSON.stringify(payload)}`);
    }

    console.log("A-4 live verification passed: generated 4-second silence returned unassessable.");
  } finally {
    const { error: removeError } = await supabase.storage.from("audio").remove([path]);

    if (removeError) {
      console.error(`A-4 cleanup warning: could not remove ${path}: ${removeError.message}`);
      process.exitCode = 1;
    }
  }
}

void main();
