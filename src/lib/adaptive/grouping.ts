import { adaptiveConfig } from "./config";
import { readingSkillById, type SkillId } from "./skills-catalog";
import type { AserLevel } from "./types";

export type GroupStudentNeed = {
  id: string;
  needBySkill: Partial<Record<SkillId, number>>;
  reviewDueSkillIds: readonly SkillId[];
};

export type FocusedGroupRecommendation = {
  affectedStudents: number;
  coverage: number;
  groupNeed: number;
  kind: "focused_card";
  reason: string;
  reviewDueStudents: number;
  skillId: SkillId;
};

export type GeneralGroupRecommendation = {
  kind: "general_card";
  reason: string;
  reviewDueStudents: number;
};

export type GroupRecommendation = FocusedGroupRecommendation | GeneralGroupRecommendation;

function inScope(skillId: SkillId, level: AserLevel) {
  return readingSkillById[skillId].aserBands.includes(level);
}

/**
 * Groups never expose individual errors. This pure aggregation only returns a
 * common focus when at least three children and 35% of the column support it.
 */
export function chooseGroupFocus({
  level,
  students,
}: {
  level: AserLevel;
  students: readonly GroupStudentNeed[];
}): GroupRecommendation {
  const reviewDueStudents = students.filter((student) => student.reviewDueSkillIds.length > 0).length;

  if (students.length === 0) {
    return {
      kind: "general_card",
      reason: `Mixed needs — use a general ${level} card.`,
      reviewDueStudents,
    };
  }

  const candidateSkillIds = new Set<SkillId>();
  for (const student of students) {
    for (const skillId of Object.keys(student.needBySkill) as SkillId[]) {
      if (inScope(skillId, level)) {
        candidateSkillIds.add(skillId);
      }
    }
  }

  const candidates = [...candidateSkillIds]
    .map((skillId) => {
      const needs = students.map((student) => student.needBySkill[skillId] ?? 0);
      const affectedStudents = needs.filter(
        (need) => need >= adaptiveConfig.selection.need.focusThreshold,
      ).length;
      return {
        affectedStudents,
        coverage: affectedStudents / students.length,
        groupNeed: needs.reduce((total, need) => total + need, 0) / students.length,
        skillId,
      };
    })
    .filter(
      (candidate) =>
        candidate.affectedStudents >= adaptiveConfig.grouping.minimumAffectedStudents &&
        candidate.coverage >= adaptiveConfig.grouping.minimumCoverage,
    )
    .sort((left, right) => {
      if (left.groupNeed !== right.groupNeed) {
        return right.groupNeed - left.groupNeed;
      }
      return left.skillId.localeCompare(right.skillId);
    });
  const selected = candidates[0];

  if (!selected) {
    return {
      kind: "general_card",
      reason: `Mixed needs — use a general ${level} card.`,
      reviewDueStudents,
    };
  }

  return {
    ...selected,
    kind: "focused_card",
    reason: `${selected.affectedStudents} children share a need with ${readingSkillById[selected.skillId].displayName}.`,
    reviewDueStudents,
  };
}
