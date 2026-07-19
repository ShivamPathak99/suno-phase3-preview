import { guardTranscriptionForAnalysis } from "../src/lib/transcription-guard";

function verify(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const silentClip = guardTranscriptionForAnalysis({
  durationSec: 4,
  text: "",
  words: [],
});

verify(silentClip.unassessable, "A four-second silent clip must be unassessable.");
verify(
  silentClip.reason === "Couldn't hear the reading — try again closer to the child",
  "A four-second silent clip must report the duration guard.",
);

const sparseTranscript = guardTranscriptionForAnalysis({
  durationSec: 8,
  text: "hello",
  words: [{ word: "hello", start: 0, end: 0.2 }],
});

verify(sparseTranscript.unassessable, "A one-word transcript must be unassessable.");
verify(
  sparseTranscript.reason === "Couldn't hear the reading — try again closer to the child",
  "A one-word transcript must report the speech guard.",
);

const denseTranscript = guardTranscriptionForAnalysis({
  durationSec: 5,
  text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty six",
  words: Array.from({ length: 26 }, (_, index) => ({
    word: `word-${index + 1}`,
    start: index / 6,
    end: (index + 1) / 6,
  })),
});

verify(denseTranscript.unassessable, "A >5 words/second transcript must be unassessable.");
verify(
  denseTranscript.reason === "The reading was too fast to assess — please try again.",
  "A dense transcript must report the density guard.",
);

const assessableTranscript = guardTranscriptionForAnalysis({
  durationSec: 8,
  text: "one two three four five six",
  words: Array.from({ length: 6 }, (_, index) => ({
    word: `word-${index + 1}`,
    start: index,
    end: index + 0.5,
  })),
});

verify(!assessableTranscript.unassessable, "A normal transcript must remain assessable.");

console.log("Transcription guards passed: short, sparse, dense, and normal cases.");
