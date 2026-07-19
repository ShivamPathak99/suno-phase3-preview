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

const compressedHallucination = guardTranscriptionForAnalysis({
  durationSec: 5.92,
  text: "hallucinated words from a quiet clip",
  words: [
    { word: "hallucinated", start: 5.28, end: 5.44 },
    { word: "words", start: 5.44, end: 5.44 },
    { word: "from", start: 5.44, end: 5.52 },
    { word: "a", start: 5.52, end: 5.52 },
    { word: "quiet", start: 5.52, end: 5.56 },
  ],
});

verify(
  compressedHallucination.unassessable,
  "A short burst of hallucinated words in a quiet clip must be unassessable.",
);
verify(
  compressedHallucination.reason === silentClip.reason,
  "A compressed hallucination must report the silence guard.",
);

const lateHallucination = guardTranscriptionForAnalysis({
  durationSec: 5.92,
  text: "hallucinated words near the end of a quiet clip",
  words: [
    { word: "hallucinated", start: 4.04, end: 5.44 },
    { word: "words", start: 5.44, end: 5.44 },
    { word: "near", start: 5.44, end: 5.44 },
    { word: "the", start: 5.44, end: 5.54 },
    { word: "end", start: 5.54, end: 5.54 },
    { word: "quiet", start: 5.54, end: 5.54 },
  ],
});

verify(
  lateHallucination.unassessable,
  "A late short hallucination in a quiet clip must be unassessable.",
);
verify(
  lateHallucination.reason === silentClip.reason,
  "A late short hallucination must report the silence guard.",
);

const fastSpeechBurst = guardTranscriptionForAnalysis({
  durationSec: 8,
  text: "one two three",
  words: [
    { word: "one", start: 3, end: 3.1 },
    { word: "two", start: 3.1, end: 3.2 },
    { word: "three", start: 3.2, end: 3.3 },
  ],
});

verify(
  fastSpeechBurst.unassessable,
  "A dense speech burst must be unassessable even inside a long clip.",
);
verify(
  fastSpeechBurst.reason === denseTranscript.reason,
  "A genuine fast burst must report the speed guard rather than silence.",
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

console.log(
  "Transcription guards passed: short, sparse, compressed, late, dense, burst, and normal cases.",
);
