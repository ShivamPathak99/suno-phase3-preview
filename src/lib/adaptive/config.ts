/**
 * Adaptive-loop thresholds and credits. Keep every numeric decision constant
 * here so the evidence log can be recomputed if a later validated tune is
 * needed.
 */
export const adaptiveConfig = {
  /** Spec §A3 — deterministic curated-card quality thresholds. */
  content: {
    card: {
      targetOccurrences: { maximum: 5, minimum: 3 },
      targetWordTypes: { minimum: 3 },
      warmUpWords: { maximum: 4, minimum: 3 },
      wordCountByLevel: {
        paragraph: { maximum: 80, minimum: 40 },
        word: { maximum: 45, minimum: 20 },
      },
    },
  },
  evidence: {
    /** Spec §A2.2. */
    credits: {
      correct: { accuracy: 1, automaticity: 1 },
      hesitation: { accuracy: 1, automaticity: 0.4 },
      self_corrected: { accuracy: 0.5, automaticity: 0.2 },
      skipped: { accuracy: 0, automaticity: 0 },
      substituted: { accuracy: 0.1, automaticity: 0 },
    },
    /** Spec §A2.3. */
    directness: {
      controlledExemplar: 1,
      teacherLabelledNonControlled: 0.5,
    },
    /** Spec §A2.3. */
    exemplarFactor: {
      firstDistinctWord: 1,
      repeatedWord: 0.5,
    },
    /** Spec §A2.3. */
    maxEffectiveWeightPerSkillPerCard: 3,
    /** Spec §A2.1. */
    reliability: {
      acceptedHighConfidence: 0.85,
      acceptedMediumConfidence: 0.6,
      disputedOrLowConfidence: 0,
      teacherEdited: 1,
    },
    /** Spec §A2.3. */
    suspicion: {
      diagnosticScoreThreshold: 1,
      minimumDistinctWords: 2,
      nonControlledBaselineFactor: 0.5,
    },
  },
  profile: {
    /** Spec §A2.4: decay is intentionally deferred in V1. */
    recencyDecayMultiplier: 1,
    /** Spec §A2.4. */
    posteriorPrior: { alpha: 1, beta: 1 },
    /** Spec §A2.4. */
    lcb90ZScore: 1.28,
    /** Spec §A2.4. */
    recentErrorEwma: {
      errorWeight: 0.3,
      initialValue: 0,
      retainedWeight: 0.7,
    },
    /** Spec §A2.5. */
    reinforce: {
      minimumEffectiveEvidence: 3,
      minimumRecentErrorEwma: 0.45,
    },
    /** Spec §A2.5. */
    mastery: {
      automaticityLcb90: 0.6,
      distinctWords: 4,
      effectiveAccuracyEvidence: 10,
      effectiveFluencyEvidence: 6,
      highQualityFailureWeight: 0.85,
      lastEventsToInspect: 5,
      minimumPracticeDays: 2,
      accuracyLcb90: 0.8,
    },
    /** Spec §A2.5. */
    prerequisite: {
      accuracyLcb90: 0.75,
      effectiveEvidence: 6,
    },
    /** Spec §A2.5. */
    reviewIntervalDays: 21,
    millisecondsPerDay: 86_400_000,
  },
  grouping: {
    /** Spec §A2.7. */
    minimumAffectedStudents: 3,
    minimumCoverage: 0.35,
  },
  math: {
    /** Spec §B3 — all deterministic item-generation bounds. */
    generator: {
      maximumDigit: 9,
      maximumTwoDigit: 99,
      minimumTwoDigit: 10,
      propertyChecksPerSkill: 1_000,
      distinguishingSearchAttempts: 64,
      factsMaximumResult: 20,
    },
    /** Spec §B3 — a baseline probe is eight items with two clear fingerprints. */
    probe: {
      itemCount: 8,
      minimumMutuallyDistinguishingItems: 2,
    },
    /** Spec §B3 — the positive, slow-progressive 7-secure / 3-focus sheet. */
    practice: {
      focusItems: 3,
      maximumConsecutiveFocusItems: 3,
      secureItems: 7,
      totalItems: 10,
    },
  },
  selection: {
    /** Spec §A2.6. */
    coldStart: {
      minimumConfirmedReadings: 2,
      minimumSkillEvidence: 2,
    },
    /** Spec §A2.6. */
    frontier: {
      maximumActiveSkills: 3,
    },
    /** Spec §A2.6. */
    need: {
      accuracyGapWeight: 0.6,
      focusThreshold: 0.45,
      maximum: 1,
      minimum: 0,
      recentErrorWeight: 0.25,
      reviewDueBonus: 0.15,
    },
    /** Spec §A2.6. */
    strategy: {
      maximumFlatFocuses: 3,
    },
  },
} as const;
