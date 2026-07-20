import { adaptiveConfig } from "./config";
import type { StudentProfile, StudentSkillProfile } from "./profile";
import { readingSkillCatalog, type Skill, type SkillId } from "./skills-catalog";
import type { AserLevel, Subject } from "./types";

export type FocusEvidenceSummary = {
  errors: number;
  hesitations: number;
  opportunities: number;
  readings: number;
};

export type FocusHistoryEntry = {
  lcb90: number;
  skillId: SkillId;
};

export type FocusScope = {
  level: AserLevel;
  studentName: string;
  subject?: Subject;
};

export type FocusedCardRecommendation = {
  evidenceSummary?: FocusEvidenceSummary;
  kind: "focused_card";
  need?: number;
  reason: string;
  skillId: SkillId;
  source: "algorithmic" | "new_skill" | "review_due" | "teacher_pin";
};

export type GeneralCardRecommendation = {
  kind: "general_card";
  reason: string;
  source: "cold_start" | "general";
};

export type TeacherStrategyRecommendation = {
  alternatives: [string, string, string];
  kind: "teacher_strategy_needed";
  reason: string;
  skillId: SkillId;
  source: "strategy_needed";
};

export type FocusRecommendation =
  | FocusedCardRecommendation
  | GeneralCardRecommendation
  | TeacherStrategyRecommendation;

export type ChooseFocusInput = {
  evidenceSummaryBySkill?: Partial<Record<SkillId, FocusEvidenceSummary>>;
  focusHistory?: readonly FocusHistoryEntry[];
  profile: StudentProfile;
  scope: FocusScope;
  skills?: readonly Skill[];
  teacherPin?: SkillId;
};

type Candidate = {
  need: number;
  profile: StudentSkillProfile;
  skill: Skill;
};

function clampNeed(value: number) {
  return Math.max(
    adaptiveConfig.selection.need.minimum,
    Math.min(adaptiveConfig.selection.need.maximum, value),
  );
}

export function needForSkill(profile: StudentSkillProfile) {
  return clampNeed(
    adaptiveConfig.selection.need.accuracyGapWeight * (1 - profile.accuracy.lcb90) +
      adaptiveConfig.selection.need.recentErrorWeight * profile.recentErrorEwma +
      adaptiveConfig.selection.need.reviewDueBonus * (profile.state === "review_due" ? 1 : 0),
  );
}

function compareCandidates(left: Candidate, right: Candidate) {
  if (left.need !== right.need) {
    return right.need - left.need;
  }

  if (left.profile.accuracy.nEffective !== right.profile.accuracy.nEffective) {
    return left.profile.accuracy.nEffective - right.profile.accuracy.nEffective;
  }

  return left.skill.id < right.skill.id ? -1 : left.skill.id > right.skill.id ? 1 : 0;
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

/** Builds the required one-sentence teacher explanation from confirmed counts. */
export function buildFocusReason(summary: FocusEvidenceSummary | undefined, skill: Skill) {
  if (!summary) {
    return `${skill.displayName} is the next useful focus based on confirmed reading evidence.`;
  }

  return `${summary.errors} ${pluralize(summary.errors, "substitution", "substitutions")} and ${summary.hesitations} ${pluralize(summary.hesitations, "hesitation", "hesitations")} across ${summary.opportunities} ${pluralize(summary.opportunities, "chance", "chances")} in ${summary.readings} ${pluralize(summary.readings, "reading", "readings")}.`;
}

function focusedRecommendation(
  skill: Skill,
  source: FocusedCardRecommendation["source"],
  evidenceSummary: FocusEvidenceSummary | undefined,
  need?: number,
): FocusedCardRecommendation {
  return {
    evidenceSummary,
    kind: "focused_card",
    need,
    reason:
      source === "new_skill"
        ? `${skill.displayName} is ready to introduce because its prerequisites are secure.`
        : source === "review_due"
          ? `${skill.displayName} is ready for a low-pressure review.`
          : source === "teacher_pin"
            ? `You chose ${skill.displayName} as the next focus.`
            : buildFocusReason(evidenceSummary, skill),
    skillId: skill.id,
    source,
  };
}

function hasFlatFocusHistory(
  skillId: SkillId,
  currentLcb90: number,
  focusHistory: readonly FocusHistoryEntry[],
) {
  const recentFocuses = focusHistory.slice(-adaptiveConfig.selection.strategy.maximumFlatFocuses);
  if (
    recentFocuses.length !== adaptiveConfig.selection.strategy.maximumFlatFocuses ||
    recentFocuses.some((focus) => focus.skillId !== skillId)
  ) {
    return false;
  }

  return currentLcb90 <= Math.max(...recentFocuses.map((focus) => focus.lcb90));
}

function strategyRecommendation(skill: Skill): TeacherStrategyRecommendation {
  return {
    alternatives: ["teacher-led blending", "smaller group", "picture support"],
    kind: "teacher_strategy_needed",
    reason: `${skill.displayName} has had three focused cards without an LCB improvement. Try teacher-led blending, a smaller group, or picture support.`,
    skillId: skill.id,
    source: "strategy_needed",
  };
}

/**
 * Selects one adaptive focus entirely from a rebuilt profile. It intentionally
 * has no access to Supabase, Next.js, or an LLM.
 */
export function chooseFocus({
  evidenceSummaryBySkill = {},
  focusHistory = [],
  profile,
  scope,
  skills = readingSkillCatalog,
  teacherPin,
}: ChooseFocusInput): FocusRecommendation {
  const skillsInScope = skills.filter(
    (skill) => skill.aserBands.includes(scope.level) && skill.subject === (scope.subject ?? "reading"),
  );
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const profileInScope = skillsInScope
    .map((skill) => ({ profile: profile.skills[skill.id], skill }))
    .filter(
      (entry): entry is { profile: StudentSkillProfile; skill: Skill } => entry.profile !== undefined,
    );
  const hasEnoughEvidence = profileInScope.some(
    ({ profile: skillProfile }) =>
      skillProfile.accuracy.nEffective >= adaptiveConfig.selection.coldStart.minimumSkillEvidence,
  );

  if (
    profile.confirmedReadingCount < adaptiveConfig.selection.coldStart.minimumConfirmedReadings ||
    !hasEnoughEvidence
  ) {
    return {
      kind: "general_card",
      reason: `Suno is still learning about ${scope.studentName} — here's a solid ${scope.level}-level card.`,
      source: "cold_start",
    };
  }

  if (teacherPin) {
    const pinnedSkill = skillById.get(teacherPin);
    const pinnedProfile = profile.skills[teacherPin];
    if (pinnedSkill && pinnedProfile?.state !== "teacher_hold") {
      return focusedRecommendation(
        pinnedSkill,
        "teacher_pin",
        evidenceSummaryBySkill[pinnedSkill.id],
      );
    }
  }

  const candidates = profileInScope
    .filter(({ profile: skillProfile }) =>
      ["active", "reinforce", "review_due"].includes(skillProfile.state),
    )
    .map(({ profile: skillProfile, skill }) => ({
      need: needForSkill(skillProfile),
      profile: skillProfile,
      skill,
    }))
    .sort(compareCandidates);
  const highestNeed = candidates[0];

  if (
    highestNeed &&
    hasFlatFocusHistory(highestNeed.skill.id, highestNeed.profile.accuracy.lcb90, focusHistory)
  ) {
    return strategyRecommendation(highestNeed.skill);
  }

  if (highestNeed && highestNeed.need >= adaptiveConfig.selection.need.focusThreshold) {
    return focusedRecommendation(
      highestNeed.skill,
      "algorithmic",
      evidenceSummaryBySkill[highestNeed.skill.id],
      highestNeed.need,
    );
  }

  const reviewCandidate = candidates.find(({ profile: skillProfile }) => skillProfile.state === "review_due");
  if (reviewCandidate) {
    return focusedRecommendation(
      reviewCandidate.skill,
      "review_due",
      evidenceSummaryBySkill[reviewCandidate.skill.id],
      reviewCandidate.need,
    );
  }

  const activeSkillCount = profileInScope.filter(
    ({ profile: skillProfile }) => skillProfile.state === "active",
  ).length;
  if (activeSkillCount < adaptiveConfig.selection.frontier.maximumActiveSkills) {
    const nextSkill = profileInScope
      .filter(
        ({ profile: skillProfile }) =>
          skillProfile.state === "new" && skillProfile.prerequisitesMet,
      )
      .map(({ skill }) => skill)
      .sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      )[0];

    if (nextSkill) {
      return focusedRecommendation(nextSkill, "new_skill", undefined);
    }
  }

  return {
    kind: "general_card",
    reason: `${scope.studentName} is solid across current targets — keep reading widely.`,
    source: "general",
  };
}
