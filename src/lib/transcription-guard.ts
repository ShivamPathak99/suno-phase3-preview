import type { TimestampedTranscription } from "@/lib/transcribe-audio";

export type UnassessableReason =
  | "Couldn't hear the reading — try again closer to the child"
  | "The reading was too fast to assess — please try again.";

export type UnassessableTranscription = {
  unassessable: true;
  reason: UnassessableReason;
};

export type TranscriptionGuardResult =
  | { unassessable: false }
  | UnassessableTranscription;

const minimumDurationSec = 5;
const minimumTranscriptWords = 3;
const maximumWordsPerSecond = 5;
const maximumHallucinatedBurstWordCount = 8;
const maximumHallucinatedBurstCoverage = 0.3;

function spokenWords(transcription: TimestampedTranscription) {
  return transcription.words.filter((word) => word.word.trim().length > 0);
}

function activeSpeechWindow(words: TimestampedTranscription["words"]) {
  if (words.length === 0) {
    return null;
  }

  const firstWordStart = Math.min(...words.map((word) => word.start));
  const lastWordEnd = Math.max(...words.map((word) => word.end));

  return {
    firstWordStart,
    spanSec: Math.max(0, lastWordEnd - firstWordStart),
  };
}

/**
 * Filters Whisper silence and hallucination cases before any analysis model is
 * called. The HTTP route preserves the A-3 success payload exactly and emits
 * the documented two-field object only when this guard rejects a recording.
 */
export function guardTranscriptionForAnalysis(
  transcription: TimestampedTranscription,
): TranscriptionGuardResult {
  if (transcription.durationSec < minimumDurationSec) {
    return {
      unassessable: true,
      reason: "Couldn't hear the reading — try again closer to the child",
    };
  }

  const words = spokenWords(transcription);
  const wordCount = words.length;

  if (wordCount < minimumTranscriptWords) {
    return {
      unassessable: true,
      reason: "Couldn't hear the reading — try again closer to the child",
    };
  }

  const speechWindow = activeSpeechWindow(words);
  const speechSpanSec = speechWindow?.spanSec ?? null;

  // Whisper can hallucinate a short phrase at the tail of an otherwise quiet
  // clip. Treat that pattern as silence so the child is not told they read too
  // fast when no reading was captured.
  if (
    wordCount <= maximumHallucinatedBurstWordCount &&
    speechWindow !== null &&
    speechWindow.firstWordStart >= transcription.durationSec / 2 &&
    speechWindow.spanSec / transcription.durationSec <= maximumHallucinatedBurstCoverage
  ) {
    return {
      unassessable: true,
      reason: "Couldn't hear the reading \u2014 try again closer to the child",
    };
  }

  if (
    wordCount / transcription.durationSec > maximumWordsPerSecond ||
    (speechSpanSec !== null && wordCount / speechSpanSec > maximumWordsPerSecond)
  ) {
    return {
      unassessable: true,
      reason: "The reading was too fast to assess — please try again.",
    };
  }

  return { unassessable: false };
}
