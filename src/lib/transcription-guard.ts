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
const maximumHallucinatedTailWordCount = 4;
const minimumHallucinatedTailStartRatio = 0.8;
const maximumHallucinatedTailCoverage = 0.1;

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

  // Whisper's known silent-clip hallucination has at most four timestamped
  // words compressed into the final sliver of an otherwise quiet recording.
  // Keep this narrow signature for the approved near-silent fixture; do not
  // reject a child merely because they began reading after a short pause.
  if (
    wordCount <= maximumHallucinatedTailWordCount &&
    speechWindow !== null &&
    speechWindow.firstWordStart >= transcription.durationSec * minimumHallucinatedTailStartRatio &&
    speechWindow.spanSec / transcription.durationSec <= maximumHallucinatedTailCoverage
  ) {
    return {
      unassessable: true,
      reason: "Couldn't hear the reading — try again closer to the child",
    };
  }

  // Keep this deliberately aligned with A-EC1's frozen rule: use the full
  // recording duration. A genuine child may begin reading late or pause after
  // a short passage, neither of which makes their recording silent.
  if (wordCount / transcription.durationSec > maximumWordsPerSecond) {
    return {
      unassessable: true,
      reason: "The reading was too fast to assess — please try again.",
    };
  }

  return { unassessable: false };
}
