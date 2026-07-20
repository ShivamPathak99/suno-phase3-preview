import type { SkillId } from "./skills-catalog";

/**
 * The frozen reading bands used by the Phase 2 adaptive engine.
 *
 * This is deliberately local to the deterministic engine rather than imported
 * from an API, database, or UI module.
 */
export type AserLevel = "letter" | "word" | "paragraph" | "story";

/** The `adaptive-card.v1` contract stored in worksheet content JSON. */
export type AdaptiveCard = {
  v: "adaptive-card.v1";
  focusSkillId: SkillId;
  mode: "individual" | "group";
  cardId: string;
  passageId: string;
  reason: string;
  evidenceSummary: {
    errors: number;
    hesitations: number;
    opportunities: number;
    readings: number;
  };
  qualityChecks: {
    passed: boolean;
    targetCount: number;
    distinctTargets: number;
    wordCount: number;
  };
};
