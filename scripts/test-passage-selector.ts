import assert from "node:assert/strict";

import {
  benchmarkPassageSelectionConfig,
  pickBenchmarkPassage,
  type BenchmarkPoolPassage,
} from "../src/lib/adaptive/passage-selector";
import {
  englishBenchmarkPassageMetadata,
  validateEnglishBenchmarkPool,
} from "../src/lib/benchmark-passage-pool";

const pool: BenchmarkPoolPassage[] = [
  { id: "letter-a", language: "en", level: "letter", source: "baseline" },
  { id: "letter-b", language: "en", level: "letter", source: "baseline" },
  { id: "letter-c", language: "en", level: "letter", source: "baseline" },
  { id: "letter-practice", language: "en", level: "letter", source: "other" },
  { id: "letter-hi", language: "hi", level: "letter", source: "baseline" },
];

const selectionInput = {
  benchmarkCount: 4,
  history: [],
  language: "en" as const,
  level: "letter" as const,
  now: "2026-07-22T09:00:00.000Z",
  pool,
  studentId: "student-refresh-stable",
};

const first = pickBenchmarkPassage(selectionInput);
const refreshed = pickBenchmarkPassage(selectionInput);
assert.ok(first);
assert.deepEqual(refreshed, first, "The upcoming benchmark must remain stable on refresh.");
assert.equal(first.passage.source, "baseline");

const confirmedRotation = pickBenchmarkPassage({
  ...selectionInput,
  benchmarkCount: selectionInput.benchmarkCount + 1,
  history: [{ occurredAt: "2026-07-22T08:55:00.000Z", passageId: first.passage.id }],
});
assert.ok(confirmedRotation);
assert.notEqual(
  confirmedRotation.passage.id,
  first.passage.id,
  "A newly confirmed benchmark must rotate away from its immediately prior form.",
);

const cycled = pickBenchmarkPassage({ ...selectionInput, selectionOffset: 1 });
assert.ok(cycled);
assert.notEqual(cycled.passage.id, first.passage.id, "Change passage must advance deterministically.");

const thinPool = pickBenchmarkPassage({
  ...selectionInput,
  history: [
    { occurredAt: "2026-07-21T09:00:00.000Z", passageId: "letter-a" },
    { occurredAt: "2026-07-20T09:00:00.000Z", passageId: "letter-b" },
    { occurredAt: "2026-07-19T09:00:00.000Z", passageId: "letter-c" },
  ],
});
assert.ok(thinPool);
assert.equal(thinPool.fallback, true, "A thin pool must fall back instead of blocking the check.");
assert.equal(thinPool.passage.id, "letter-c", "LRU fallback chooses the least recently read form.");

const hindiSelection = pickBenchmarkPassage({
  ...selectionInput,
  language: "hi",
  history: [],
});
assert.ok(hindiSelection);
assert.equal(hindiSelection.passage.id, "letter-hi", "Benchmark selection must remain language scoped.");
assert.equal(benchmarkPassageSelectionConfig.noRepeatCount, 2);
assert.equal(benchmarkPassageSelectionConfig.noRepeatDays, 21);

const bodyByLevel = {
  letter: "A B C D\nE F G H\nI J K L\nM N O P",
  word: "sun\nbus\ncup\nred\nfish\nbook\nmilk\nhand\nmango\nwater\nschool\nchair\nplant\nsmile\nfriend\npencil\nwindow\norange\nmarket\nbasket",
  paragraph:
    "Ravi walks to school with his sister. They see a red kite above the field. A small dog runs beside them. They smile and wave before class begins.",
  story:
    "On Saturday, Neel went to the market with his father. They bought tomatoes and three ripe mangoes. The shopkeeper wrapped them in paper and placed them in a cloth bag. At home, Neel washed the mangoes and put them in a bowl. His little sister clapped because dessert was ready.",
};
const validEnglishPool = englishBenchmarkPassageMetadata.map((metadata) => ({
  body: bodyByLevel[metadata.level],
  id: metadata.id,
  language: "en",
  level: metadata.level,
}));
assert.equal(validateEnglishBenchmarkPool(validEnglishPool), true);

const malformedPool = validEnglishPool.map((passage) =>
  passage.id === "20000000-0000-4000-8000-000000000016"
    ? { ...passage, body: "too short" }
    : passage,
);
assert.throws(() => validateEnglishBenchmarkPool(malformedPool));

console.log("P3-T8 passage selector passed: deterministic rotation, LRU fallback, language scoping, and pool bands.");
