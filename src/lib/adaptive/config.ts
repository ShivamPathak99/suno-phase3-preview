/**
 * Adaptive-loop thresholds and credits. Keep every numeric decision constant
 * here so the evidence log can be recomputed if a later validated tune is
 * needed.
 */
export const adaptiveConfig = {
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
} as const;
