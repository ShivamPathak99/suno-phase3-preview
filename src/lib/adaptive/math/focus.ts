import type { MathCheckDraft } from "./check-contract";
import { generatePracticeSet, generateRecheckItems, type MathItem } from "./item-generator";
import { mathSkillIds, type MathSkillId } from "./skills-catalog";

export type StoredMathFocus = {
  bugId: string;
  focusSkillId: MathSkillId;
  reason: string;
  state: "reinforce";
};

export type MathPracticePlan = {
  practiceItems: MathItem[];
  recheckItems: MathItem[];
  secureSkillIds: MathSkillId[];
};

const secureSkillsByFocus: Record<MathSkillId, MathSkillId[]> = {
  "math.add.carry": ["math.add.facts20", "math.add.no_carry", "math.sub.facts20"],
  "math.add.facts20": ["math.sub.facts20", "math.sub.no_borrow", "math.add.no_carry"],
  "math.add.no_carry": ["math.add.facts20", "math.sub.facts20", "math.sub.no_borrow"],
  "math.sub.borrow": ["math.sub.facts20", "math.sub.no_borrow", "math.add.facts20"],
  "math.sub.facts20": ["math.add.facts20", "math.add.no_carry", "math.sub.no_borrow"],
  "math.sub.no_borrow": ["math.sub.facts20", "math.add.facts20", "math.add.no_carry"],
};

function isMathSkillId(value: unknown): value is MathSkillId {
  return typeof value === "string" && mathSkillIds.includes(value as MathSkillId);
}

/** Safely reads only the focused recommendation persisted by math confirmation. */
export function storedMathFocus(check: MathCheckDraft): StoredMathFocus | null {
  const adaptive = check._adaptive as typeof check._adaptive & { mathDiagnosis?: unknown };
  if (typeof adaptive.mathDiagnosis !== "object" || adaptive.mathDiagnosis === null) {
    return null;
  }
  const recommendation = (adaptive.mathDiagnosis as { recommendation?: unknown }).recommendation;
  if (typeof recommendation !== "object" || recommendation === null) {
    return null;
  }
  const focus = recommendation as Partial<StoredMathFocus>;
  if (
    !isMathSkillId(focus.focusSkillId) ||
    typeof focus.bugId !== "string" ||
    typeof focus.reason !== "string" ||
    focus.state !== "reinforce"
  ) {
    return null;
  }

  return {
    bugId: focus.bugId,
    focusSkillId: focus.focusSkillId,
    reason: focus.reason,
    state: focus.state,
  };
}

export function createMathPracticePlan({
  focusSkillId,
  sourceAssessmentId,
}: {
  focusSkillId: MathSkillId;
  sourceAssessmentId: string;
}): MathPracticePlan {
  const secureSkillIds = secureSkillsByFocus[focusSkillId];
  const seed = `${sourceAssessmentId}:${focusSkillId}`;

  return {
    practiceItems: generatePracticeSet({ focusSkillId, secureSkillIds, seed }),
    recheckItems: generateRecheckItems({ focusSkillId, secureSkillIds, seed }),
    secureSkillIds,
  };
}
