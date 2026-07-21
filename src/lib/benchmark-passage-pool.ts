/**
 * Seed-only metadata for the English benchmark pool. The `passages` table is
 * intentionally unchanged in Phase 3, so calibration status travels beside
 * the seeded IDs until content is calibrated with classroom data.
 */
export const benchmarkPassagePoolConfig = {
  // F7.2: every English ASER level needs at least three parallel baseline forms.
  minimumEnglishPassagesPerLevel: 3,
} as const;

export const benchmarkLevels = ["letter", "word", "paragraph", "story"] as const;

export type BenchmarkLevel = (typeof benchmarkLevels)[number];

export type BenchmarkCalibration = {
  contentStatus: "demo_placeholder";
  source: "baseline";
  vocabularyTier: string;
};

export type BenchmarkPassageMetadata = {
  calibration: BenchmarkCalibration;
  id: string;
  level: BenchmarkLevel;
};

export type BenchmarkDifficultyBand = {
  allowedVocabularyTiers: readonly string[];
  maximumMeanSentenceWords: number;
  maximumWordCount: number;
  minimumMeanSentenceWords: number;
  minimumWordCount: number;
};

/**
 * Broad guard rails for the seeded parallel forms. They do not claim that the
 * demo text is classroom-calibrated; the content remains explicitly marked as
 * placeholder calibration until a human benchmark study replaces it.
 */
export const englishBenchmarkDifficultyBands: Record<BenchmarkLevel, BenchmarkDifficultyBand> = {
  letter: {
    allowedVocabularyTiers: ["familiar uppercase letter recognition"],
    maximumMeanSentenceWords: 4,
    maximumWordCount: 24,
    minimumMeanSentenceWords: 1,
    minimumWordCount: 12,
  },
  word: {
    allowedVocabularyTiers: ["familiar CVC and everyday words"],
    maximumMeanSentenceWords: 2,
    maximumWordCount: 26,
    minimumMeanSentenceWords: 1,
    minimumWordCount: 15,
  },
  paragraph: {
    allowedVocabularyTiers: ["short familiar school and home sentences"],
    maximumMeanSentenceWords: 12,
    maximumWordCount: 52,
    minimumMeanSentenceWords: 3,
    minimumWordCount: 24,
  },
  story: {
    allowedVocabularyTiers: ["everyday narrative with simple sequencing"],
    maximumMeanSentenceWords: 14,
    maximumWordCount: 100,
    minimumMeanSentenceWords: 3,
    minimumWordCount: 45,
  },
};

/**
 * The content is realistic demo material, but it is deliberately marked as
 * placeholder calibration until a human benchmark study replaces it.
 */
export const englishBenchmarkPassageMetadata: readonly BenchmarkPassageMetadata[] = [
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar uppercase letter recognition",
    },
    id: "20000000-0000-4000-8000-000000000001",
    level: "letter",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar uppercase letter recognition",
    },
    id: "20000000-0000-4000-8000-000000000012",
    level: "letter",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar uppercase letter recognition",
    },
    id: "20000000-0000-4000-8000-000000000013",
    level: "letter",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar CVC and everyday words",
    },
    id: "20000000-0000-4000-8000-000000000003",
    level: "word",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar CVC and everyday words",
    },
    id: "20000000-0000-4000-8000-000000000014",
    level: "word",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "familiar CVC and everyday words",
    },
    id: "20000000-0000-4000-8000-000000000015",
    level: "word",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "short familiar school and home sentences",
    },
    id: "20000000-0000-4000-8000-000000000005",
    level: "paragraph",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "short familiar school and home sentences",
    },
    id: "20000000-0000-4000-8000-000000000016",
    level: "paragraph",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "short familiar school and home sentences",
    },
    id: "20000000-0000-4000-8000-000000000017",
    level: "paragraph",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "everyday narrative with simple sequencing",
    },
    id: "20000000-0000-4000-8000-000000000007",
    level: "story",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "everyday narrative with simple sequencing",
    },
    id: "20000000-0000-4000-8000-000000000018",
    level: "story",
  },
  {
    calibration: {
      contentStatus: "demo_placeholder",
      source: "baseline",
      vocabularyTier: "everyday narrative with simple sequencing",
    },
    id: "20000000-0000-4000-8000-000000000019",
    level: "story",
  },
] as const;

// The current seeded Hindi forms are baseline forms too. Keeping this small
// registry beside the English calibration metadata prevents a focused-practice
// or math sentinel passage becoming a benchmark merely because it shares a
// level and language.
export const baselineBenchmarkPassageIds = new Set([
  ...englishBenchmarkPassageMetadata.map((passage) => passage.id),
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000004",
  "20000000-0000-4000-8000-000000000006",
  "20000000-0000-4000-8000-000000000008",
]);

export function isBaselineBenchmarkPassageId(passageId: string) {
  return baselineBenchmarkPassageIds.has(passageId);
}

type PoolPassage = {
  body: string;
  id: string;
  language: string;
  level: string;
};

function englishWords(body: string) {
  return body.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
}

function meanSentenceWords(body: string, words: readonly string[]) {
  const sentences = body
    .split(/[.!?]+|\n+/u)
    .map((sentence) => englishWords(sentence).length)
    .filter((count) => count > 0);

  return sentences.length > 0 ? words.length / sentences.length : 0;
}

function isWithinDifficultyBand(metadata: BenchmarkPassageMetadata, passage: PoolPassage) {
  const band = englishBenchmarkDifficultyBands[metadata.level];
  const words = englishWords(passage.body);
  const meanWords = meanSentenceWords(passage.body, words);

  return (
    words.length >= band.minimumWordCount &&
    words.length <= band.maximumWordCount &&
    meanWords >= band.minimumMeanSentenceWords &&
    meanWords <= band.maximumMeanSentenceWords &&
    band.allowedVocabularyTiers.includes(metadata.calibration.vocabularyTier)
  );
}

/** Validates structure, source metadata, and broad F7.2 difficulty bands. */
export function validateEnglishBenchmarkPool(passages: readonly PoolPassage[]) {
  const byId = new Map(passages.map((passage) => [passage.id, passage]));
  const seenMetadataIds = new Set<string>();

  for (const metadata of englishBenchmarkPassageMetadata) {
    if (seenMetadataIds.has(metadata.id)) {
      throw new Error(`Benchmark metadata repeats passage ${metadata.id}.`);
    }
    seenMetadataIds.add(metadata.id);

    const passage = byId.get(metadata.id);
    if (!passage || passage.language !== "en" || passage.level !== metadata.level) {
      throw new Error(`Benchmark metadata does not match an English ${metadata.level} passage.`);
    }
    if (metadata.calibration.source !== "baseline") {
      throw new Error(`Benchmark passage ${metadata.id} must be a baseline form.`);
    }
    if (!isWithinDifficultyBand(metadata, passage)) {
      throw new Error(`Benchmark passage ${metadata.id} falls outside its ${metadata.level} difficulty band.`);
    }
  }

  for (const level of benchmarkLevels) {
    const count = englishBenchmarkPassageMetadata.filter((metadata) => metadata.level === level)
      .length;
    if (count < benchmarkPassagePoolConfig.minimumEnglishPassagesPerLevel) {
      throw new Error(
        `English ${level} needs at least ${benchmarkPassagePoolConfig.minimumEnglishPassagesPerLevel} benchmark passages.`,
      );
    }
  }

  return true;
}
