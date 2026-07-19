import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { analysisSchema } from "../src/lib/analysisSchema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.SUNO_APP_BASE_URL ?? "http://127.0.0.1:3001";
const studentId = "10000000-0000-4000-8000-000000000001";
const wordPassageId = "20000000-0000-4000-8000-000000000003";
const storyPassageId = "20000000-0000-4000-8000-000000000007";

function fail(message: string): never {
  throw new Error(`A-5 live verification failed: ${message}`);
}

function wordsForPassage(body: string) {
  return body
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{M}\p{N}]/gu, ""))
    .filter(Boolean);
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
  let assessmentId: string | undefined;

  try {
    const { data: passage, error: passageError } = await supabase
      .from("passages")
      .select("body")
      .eq("id", wordPassageId)
      .single();

    if (passageError || !passage || typeof passage.body !== "string") {
      fail(`could not load the seeded English word passage: ${passageError?.message ?? "missing body"}`);
    }

    const passageWords = wordsForPassage(passage.body);
    const transcript = {
      text: passageWords.join(" "),
      durationSec: passageWords.length * 0.7,
      words: passageWords.map((word, index) => ({
        word,
        start: Number((index * 0.7).toFixed(2)),
        end: Number((index * 0.7 + 0.45).toFixed(2)),
      })),
    };
    const audioUrl = new URL(
      `/storage/v1/object/public/audio/verification/a5-synthetic-${randomUUID()}.webm`,
      supabaseUrl,
    ).toString();
    const response = await fetch(`${appBaseUrl}/api/analyze`, {
      body: JSON.stringify({ studentId, passageId: wordPassageId, audioUrl, transcript }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload: unknown = await response.json();

    if (response.status !== 200 || !payload || typeof payload !== "object") {
      fail(`expected a 200 JSON response, received ${response.status}: ${JSON.stringify(payload)}`);
    }

    const record = payload as { analysis?: unknown; assessmentId?: unknown };

    if (typeof record.assessmentId !== "string") {
      fail("the response did not include a draft assessmentId.");
    }

    assessmentId = record.assessmentId;
    const analysis = analysisSchema.safeParse(record.analysis);

    if (!analysis.success) {
      fail(`the response analysis failed the frozen schema: ${analysis.error.message}`);
    }

    const { data: draft, error: draftError } = await supabase
      .from("assessments")
      .select("id, teacher_confirmed, analysis_json, transcript_json, level, wcpm, accuracy")
      .eq("id", assessmentId)
      .single();

    if (draftError || !draft) {
      fail(`the draft assessment was not persisted: ${draftError?.message ?? "missing row"}`);
    }

    if (draft.teacher_confirmed !== false) {
      fail("the saved assessment must remain a teacher-unconfirmed draft.");
    }

    if (
      !isDeepStrictEqual(draft.analysis_json, analysis.data) ||
      !isDeepStrictEqual(draft.transcript_json, transcript) ||
      draft.level !== analysis.data.level ||
      Number(draft.wcpm) !== analysis.data.wcpm ||
      Number(draft.accuracy) !== analysis.data.accuracy_pct
    ) {
      fail("the persisted draft does not match the frozen response and transcript contract.");
    }

    const { count: assessmentCountBeforeMismatch, error: countBeforeError } = await supabase
      .from("assessments")
      .select("*", { count: "exact", head: true });

    if (countBeforeError || assessmentCountBeforeMismatch === null) {
      fail(`could not count draft assessments before mismatch: ${countBeforeError?.message ?? "no count"}`);
    }

    const mismatchResponse = await fetch(`${appBaseUrl}/api/analyze`, {
      body: JSON.stringify({
        studentId,
        passageId: storyPassageId,
        audioUrl,
        transcript,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const mismatchPayload: unknown = await mismatchResponse.json();

    if (
      mismatchResponse.status !== 422 ||
      !mismatchPayload ||
      typeof mismatchPayload !== "object" ||
      (mismatchPayload as Record<string, unknown>).unassessable !== true ||
      (mismatchPayload as Record<string, unknown>).reason !==
        "reading did not match the passage"
    ) {
      fail(
        `a wrong passage must be unassessable; received ${mismatchResponse.status}: ${JSON.stringify(mismatchPayload)}`,
      );
    }

    const { count: assessmentCountAfterMismatch, error: countAfterError } = await supabase
      .from("assessments")
      .select("*", { count: "exact", head: true });

    if (
      countAfterError ||
      assessmentCountAfterMismatch !== assessmentCountBeforeMismatch
    ) {
      fail(
        `wrong-passage analysis must not save a draft: ${countAfterError?.message ?? `${assessmentCountBeforeMismatch} became ${assessmentCountAfterMismatch}`}`,
      );
    }

    console.log(
      `A-5 live verification passed: draft ${assessmentId} saved with ${analysis.data.words.length} word assessments; wrong-passage guard also passed.`,
    );
  } finally {
    if (assessmentId) {
      const { error: deleteError } = await supabase
        .from("assessments")
        .delete()
        .eq("id", assessmentId);

      if (deleteError) {
        console.error(
          `A-5 cleanup warning: could not remove test draft ${assessmentId}: ${deleteError.message}`,
        );
        process.exitCode = 1;
      }
    }
  }
}

void main();
