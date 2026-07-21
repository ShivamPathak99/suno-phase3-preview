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

type PoolPassage = {
  id: string;
  language: string;
  level: string;
};

/** Pure structural validation; F7 supplies difficulty-band checks in P3-T8. */
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
