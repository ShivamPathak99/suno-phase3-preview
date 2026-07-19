import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { analysisSchema } from "../src/lib/analysisSchema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.SUNO_APP_BASE_URL ?? "http://127.0.0.1:3000";
const studentId = "10000000-0000-4000-8000-000000000006";
const passageId = "20000000-0000-4000-8000-000000000003";

function fail(message: string): never {
  throw new Error(`Gate 3 confirmation verification failed: ${message}`);
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
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  let assessmentId: string | undefined;

  try {
    const { data: passage, error: passageError } = await supabase
      .from("passages")
      .select("body")
      .eq("id", passageId)
      .single();

    if (passageError || !passage || typeof passage.body !== "string") {
      fail(`could not load the seeded word passage: ${passageError?.message ?? "missing body"}`);
    }

    const passageWords = wordsForPassage(passage.body);
    const transcript = {
      durationSec: passageWords.length,
      text: passageWords.join(" "),
      words: passageWords.map((word, index) => ({
        end: index + 0.8,
        start: index,
        word,
      })),
    };
    const draftAnalysis = analysisSchema.parse({
      accuracy_pct: 100,
      level: "word",
      recommended_focus: "Reading familiar words smoothly",
      summary_for_teacher: "A synthetic draft used only to verify confirmation.",
      wcpm: 60,
      words: passageWords.map((passageWord) => ({
        confidence: "high",
        heard_as: null,
        passage_word: passageWord,
        status: "correct",
      })),
    });
    assessmentId = randomUUID();

    const { error: insertError } = await supabase.from("assessments").insert({
      accuracy: draftAnalysis.accuracy_pct,
      analysis_json: draftAnalysis,
      audio_url: new URL(
        `/storage/v1/object/public/audio/verification/gate3-${assessmentId}.webm`,
        supabaseUrl,
      ).toString(),
      id: assessmentId,
      level: draftAnalysis.level,
      passage_id: passageId,
      student_id: studentId,
      teacher_confirmed: false,
      transcript_json: transcript,
      wcpm: draftAnalysis.wcpm,
    });

    if (insertError) {
      fail(`could not create disposable draft: ${insertError.message}`);
    }

    const draftPage = await fetch(
      `${appBaseUrl}/assess/${studentId}?assessmentId=${encodeURIComponent(assessmentId)}`,
    );
    const draftPageHtml = await draftPage.text();
    if (!draftPage.ok || !draftPageHtml.includes("Tap a word to review it")) {
      fail(`stable draft route did not render confirmation UI (${draftPage.status}).`);
    }

    const confirmation = await fetch(
      `${appBaseUrl}/api/assessments/${assessmentId}/confirm`,
      {
        body: JSON.stringify({
          overrides: [{ heard_as: null, passage_word_index: 0, status: "skipped" }],
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    const confirmationPayload = (await confirmation.json()) as {
      assessment?: {
        accuracy_pct?: unknown;
        analysis?: unknown;
        id?: unknown;
        level?: unknown;
        wcpm?: unknown;
      };
    };

    if (confirmation.status !== 200 || !confirmationPayload.assessment) {
      fail(`expected confirmation 200, received ${confirmation.status}.`);
    }

    const confirmedAnalysis = analysisSchema.safeParse(confirmationPayload.assessment.analysis);
    if (!confirmedAnalysis.success) {
      fail("confirmation response analysis did not satisfy the frozen schema.");
    }

    const expectedAccuracy = Number(((passageWords.length - 1) / passageWords.length * 100).toFixed(1));
    const expectedWcpm = Number((((passageWords.length - 1) / passageWords.length) * 60).toFixed(1));
    if (
      confirmationPayload.assessment.id !== assessmentId ||
      confirmationPayload.assessment.level !== "word" ||
      confirmationPayload.assessment.accuracy_pct !== expectedAccuracy ||
      confirmationPayload.assessment.wcpm !== expectedWcpm ||
      confirmedAnalysis.data.words[0]?.status !== "skipped"
    ) {
      fail("confirmation response did not persist and recompute the teacher override.");
    }

    const { data: saved, error: savedError } = await supabase
      .from("assessments")
      .select("teacher_confirmed, analysis_json, level, accuracy, wcpm")
      .eq("id", assessmentId)
      .single();

    if (
      savedError ||
      !saved ||
      saved.teacher_confirmed !== true ||
      saved.level !== "word" ||
      Number(saved.accuracy) !== expectedAccuracy ||
      Number(saved.wcpm) !== expectedWcpm ||
      !analysisSchema.safeParse(saved.analysis_json).success
    ) {
      fail(`confirmed draft was not persisted: ${savedError?.message ?? "invalid saved row"}`);
    }

    const dashboard = await fetch(
      `${appBaseUrl}/?assessmentId=${encodeURIComponent(assessmentId)}`,
    );
    const dashboardHtml = await dashboard.text();
    const dashboardText = dashboardHtml.replace(/<!--[\s\S]*?-->/gu, "");
    if (!dashboard.ok || !dashboardText.includes("Gopal confirmed at word level")) {
      fail(`the live dashboard did not slot in the confirmed assessment (${dashboard.status}).`);
    }

    const repeatedConfirmation = await fetch(
      `${appBaseUrl}/api/assessments/${assessmentId}/confirm`,
      {
        body: JSON.stringify({ overrides: [] }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    const repeatedPayload = (await repeatedConfirmation.json()) as {
      assessment?: { accuracy_pct?: unknown; id?: unknown; wcpm?: unknown };
    };
    const repeatedAssessment = repeatedPayload.assessment;

    if (
      repeatedConfirmation.status !== 200 ||
      !repeatedAssessment ||
      repeatedAssessment.id !== assessmentId ||
      repeatedAssessment.accuracy_pct !== expectedAccuracy ||
      repeatedAssessment.wcpm !== expectedWcpm
    ) {
      fail("the confirmation endpoint was not idempotent.");
    }

    console.log(
      `Gate 3 confirmation verification passed: draft ${assessmentId} rendered, confirmed, recomputed, and returned idempotently.`,
    );
  } finally {
    if (assessmentId) {
      const { error: deleteError } = await supabase.from("assessments").delete().eq("id", assessmentId);

      if (deleteError) {
        console.error(`Cleanup warning: could not remove test draft ${assessmentId}: ${deleteError.message}`);
        process.exitCode = 1;
      }
    }
  }
}

void main();
