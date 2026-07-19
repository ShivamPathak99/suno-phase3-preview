import {
  type WorksheetContent,
  worksheetContentSchema,
  worksheetJsonSchema,
  worksheetRequestSchema,
  worksheetWordCount,
  worksheetWordCountBands,
  validateWorksheet,
} from "../src/lib/worksheetSchema";
import { readingLevels } from "../src/lib/analysisSchema";

function verify(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function generatedWords(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");
}

const fixtures: Record<(typeof readingLevels)[number], WorksheetContent> = {
  letter: {
    title: "Letter practice",
    body: "A M S T P N I C O B D G",
    question: "Which letter comes after A?",
  },
  word: {
    title: "Everyday words",
    body: "sun bus cup red fish book milk hand mango water school chair",
    question: "Which word names something you can drink?",
  },
  paragraph: {
    title: "A small garden",
    body: generatedWords(40, "paragraph"),
    question: "What is the paragraph about?",
  },
  story: {
    title: "A day at school",
    body: generatedWords(90, "story"),
    question: "What happened in the story?",
  },
};

for (const level of readingLevels) {
  const worksheet = validateWorksheet(fixtures[level], level);
  const band = worksheetWordCountBands[level];
  const count = worksheetWordCount(worksheet.body);

  verify(
    count >= band.min && count <= band.max,
    `${level} fixture must remain inside its word-count band.`,
  );
  verify(
    worksheetRequestSchema.safeParse({ level, language: "en" }).success,
    `${level} English request must remain valid.`,
  );
}

verify(
  worksheetRequestSchema.safeParse({ level: "word", language: "hi" }).success,
  "The frozen language input enum must retain hi.",
);
verify(
  worksheetRequestSchema.safeParse({ level: "word", language: "ta" }).success === false,
  "Unknown worksheet languages must be rejected.",
);
verify(
  worksheetContentSchema.safeParse({ ...fixtures.word, unexpected: true }).success === false,
  "Worksheet content must reject unexpected fields.",
);
verify(
  worksheetJsonSchema.additionalProperties === false &&
    worksheetJsonSchema.required.length === 3,
  "The Structured Outputs schema must require only the frozen worksheet fields.",
);

const invalidQuestion = { ...fixtures.word, question: "Find the word water" };
let rejectedInvalidQuestion = false;

try {
  validateWorksheet(invalidQuestion, "word");
} catch {
  rejectedInvalidQuestion = true;
}

verify(rejectedInvalidQuestion, "A worksheet must contain exactly one question.");

let rejectedEmptyQuestion = false;

try {
  validateWorksheet({ ...fixtures.word, question: "?" }, "word");
} catch {
  rejectedEmptyQuestion = true;
}

verify(rejectedEmptyQuestion, "A worksheet question must contain meaningful text.");

const shortStory = { ...fixtures.story, body: "A short story" };
let rejectedShortStory = false;

try {
  validateWorksheet(shortStory, "story");
} catch {
  rejectedShortStory = true;
}

verify(rejectedShortStory, "A worksheet body must satisfy its level-specific word-count band.");

console.log("Worksheet contract passed: frozen shape, four English levels, and semantic bands.");
