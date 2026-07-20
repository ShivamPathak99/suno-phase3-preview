import { adaptiveConfig } from "../config";
import { bugCatalog, mathBugIds, type BugId } from "./bug-catalog";
import type { MathItem } from "./item-generator";
import { mathSkillIds, type MathSkillId } from "./skills-catalog";

export type MathCheckPurpose = "diagnostic" | "practice_check";
export type MathReviewTag = "dismiss" | "slip" | BugId;

export type MathResponse = {
  answer: number;
  item: MathItem;
  reviewTag?: MathReviewTag;
};

export type MathBugDiagnosis = {
  confirmed: boolean;
  distinctItemIds: string[];
  id: BugId;
  score: number;
};

export type MathEvidenceEvent = {
  assessmentId: string;
  bugId: BugId;
  distinctItemKey: string;
  occurredAt: string;
  purpose: MathCheckPurpose;
  reliability: number;
  skillId: MathSkillId;
  studentId: string;
  subject: "math";
  weight: number;
};

export type MathFocusRecommendation = {
  bugId: BugId;
  focusSkillId: MathSkillId;
  reason: string;
  state: "reinforce";
};

export type MathDiagnosis = {
  bugs: Record<BugId, MathBugDiagnosis>;
  evidence: MathEvidenceEvent[];
  recommendation?: MathFocusRecommendation;
  skillStates: Record<MathSkillId, "growing" | "reinforce">;
};

export type DiagnoseMathResponsesInput = {
  assessmentId?: string;
  occurredAt: string;
  purpose: MathCheckPurpose;
  responses: readonly MathResponse[];
  studentId: string;
};

function skillForBug(bugId: BugId): MathSkillId {
  switch (bugId) {
    case "add.carry_added_twice":
    case "add.carry_as_digit":
    case "add.dropped_carry":
    case "add.no_place_value":
      return "math.add.carry";
    case "sub.smaller_from_larger":
    case "sub.borrow_no_decrement":
    case "sub.zero_takes_n":
      return "math.sub.borrow";
    case "sub.zero_gives_zero":
      return "math.sub.no_borrow";
  }
}

function focusPhrase(bugId: BugId) {
  switch (bugId) {
    case "add.dropped_carry":
      return "Practise carrying in addition";
    case "add.carry_as_digit":
      return "Practise carrying one ten into the next column";
    case "add.carry_added_twice":
      return "Practise adding the carry once";
    case "add.no_place_value":
      return "Practise keeping tens and ones in their columns";
    case "sub.smaller_from_larger":
      return "Practise subtracting in the correct order";
    case "sub.borrow_no_decrement":
      return "Practise reducing the tens after borrowing";
    case "sub.zero_gives_zero":
      return "Practise subtracting with zero";
    case "sub.zero_takes_n":
      return "Practise subtracting from zero carefully";
  }
}

function bugReasonName(bugId: BugId) {
  return bugId.replace(".", "-").replace(/_/g, "-");
}

function emptyBugs(): Record<BugId, MathBugDiagnosis> {
  return Object.fromEntries(
    mathBugIds.map((id) => [id, { confirmed: false, distinctItemIds: [], id, score: 0 }]),
  ) as unknown as Record<BugId, MathBugDiagnosis>;
}

function matchingBugs(response: MathResponse) {
  if (response.answer === response.item.answer || response.reviewTag === "dismiss" || response.reviewTag === "slip") {
    return [] as BugId[];
  }

  if (response.reviewTag) {
    const taggedBug = bugCatalog[response.reviewTag];
    if (taggedBug.operation !== response.item.op) {
      throw new Error(`Teacher tag ${response.reviewTag} cannot apply to ${response.item.op}.`);
    }
    return [response.reviewTag];
  }

  return (Object.entries(response.item.bugPredictions) as Array<[BugId, number]>)
    .filter(([bugId, prediction]) => bugCatalog[bugId].operation === response.item.op && prediction === response.answer)
    .map(([bugId]) => bugId)
    .sort();
}

function reliabilityFor(response: MathResponse) {
  return response.reviewTag
    ? adaptiveConfig.math.diagnosis.teacherReviewedReliability
    : adaptiveConfig.math.diagnosis.autoMatchReliability;
}

/**
 * Converts reviewed math answers into auditable bug evidence. Repeated copies
 * of an item never amplify a diagnosis; only distinct item IDs can contribute.
 */
export function diagnoseMathResponses({
  assessmentId,
  occurredAt,
  purpose,
  responses,
  studentId,
}: DiagnoseMathResponsesInput): MathDiagnosis {
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error("Math diagnosis requires a valid ISO occurredAt timestamp.");
  }

  const bugs = emptyBugs();
  const evidence: MathEvidenceEvent[] = [];
  const seenBugItemPairs = new Set<string>();
  const resolvedAssessmentId = assessmentId ?? `math-check:${studentId}:${occurredAt}`;

  for (const response of responses) {
    const matchedBugs = matchingBugs(response);
    if (matchedBugs.length === 0) {
      continue;
    }

    const reliability = reliabilityFor(response);
    const splitCredit = reliability / matchedBugs.length;
    for (const bugId of matchedBugs) {
      const pairKey = `${bugId}:${response.item.id}`;
      if (seenBugItemPairs.has(pairKey)) {
        continue;
      }
      seenBugItemPairs.add(pairKey);

      const bug = bugs[bugId];
      bug.score += splitCredit;
      bug.distinctItemIds.push(response.item.id);
      evidence.push({
        assessmentId: resolvedAssessmentId,
        bugId,
        distinctItemKey: response.item.id,
        occurredAt,
        purpose,
        reliability,
        skillId: skillForBug(bugId),
        studentId,
        subject: "math",
        weight: splitCredit,
      });
    }
  }

  for (const bug of Object.values(bugs)) {
    bug.distinctItemIds.sort();
    bug.confirmed =
      bug.score >= adaptiveConfig.math.diagnosis.confirmationScore &&
      bug.distinctItemIds.length >= adaptiveConfig.math.diagnosis.confirmationMinimumDistinctItems;
  }

  const skillStates = Object.fromEntries(
    mathSkillIds.map((skillId) => [skillId, "growing"]),
  ) as Record<MathSkillId, "growing" | "reinforce">;
  const selectedBug = Object.values(bugs)
    .filter((bug) => bug.confirmed)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))[0];

  if (!selectedBug) {
    return { bugs, evidence, skillStates };
  }

  const focusSkillId = skillForBug(selectedBug.id);
  skillStates[focusSkillId] = "reinforce";
  const noun = focusSkillId.startsWith("math.add.") ? "sums" : "problems";
  return {
    bugs,
    evidence,
    recommendation: {
      bugId: selectedBug.id,
      focusSkillId,
      reason: `${focusPhrase(selectedBug.id)} — ${selectedBug.distinctItemIds.length} ${bugReasonName(selectedBug.id)} answers across ${selectedBug.distinctItemIds.length} different ${noun}.`,
      state: "reinforce",
    },
    skillStates,
  };
}
