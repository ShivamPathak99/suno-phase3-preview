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

function spokenWordCount(transcription: TimestampedTranscription) {
  return transcription.words.filter((word) => word.word.trim().length > 0).length;
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

  const wordCount = spokenWordCount(transcription);

  if (wordCount < minimumTranscriptWords) {
    return {
      unassessable: true,
      reason: "Couldn't hear the reading — try again closer to the child",
    };
  }

  if (wordCount / transcription.durationSec > maximumWordsPerSecond) {
    return {
      unassessable: true,
      reason: "The reading was too fast to assess — please try again.",
    };
  }

  return { unassessable: false };
}
