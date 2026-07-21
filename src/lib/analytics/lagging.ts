import type { StudentProfile, StudentSkillProfile } from "@/lib/adaptive/profile";
import { readingSkillById, type SkillId } from "@/lib/adaptive/skills-catalog";
import type { SkillEvidenceEvent } from "@/lib/adaptive/evidence";

export type FeedbackState = "practising" | "growing" | "secure" | "ready to review";

export type SkillMiss = {
  count: number;
  detail: string;
  skillId: SkillId;
  skillName: string;
};

export type SkillStanding = {
  chances: number;
  skillId: SkillId;
  skillName: string;
  state: FeedbackState;
};

export type FeedbackSummary = {
  confidenceNote?: string;
  cumulative: SkillStanding[];
  strengths: SkillStanding[];
  thisRead: SkillMiss[];
  untrackedMisses: number;
};

function feedbackState(profile: StudentSkillProfile): FeedbackState {
  if (profile.state === "mastered") return "secure";
  if (profile.state === "review_due") return "ready to review";
  if (profile.state === "active" || profile.state === "new") return "growing";
  return "practising";
}

function standingFor(skillId: SkillId, profile: StudentSkillProfile): SkillStanding {
  return {
    chances: Math.round(profile.accuracy.nEffective),
    skillId,
    skillName: readingSkillById[skillId].displayName,
    state: feedbackState(profile),
  };
}

function errorDetail(events: readonly SkillEvidenceEvent[]) {
  const substitutions = events.filter((event) => event.outcome === "substituted" || event.outcome === "skipped").length;
  const hesitations = events.filter((event) => event.outcome === "hesitation").length;
  const pieces = [
    substitutions > 0 ? `${substitutions} ${substitutions === 1 ? "miss" : "misses"}` : null,
    hesitations > 0 ? `${hesitations} ${hesitations === 1 ? "hesitation" : "hesitations"}` : null,
  ].filter((value): value is string => value !== null);

  return pieces.join(" · ");
}

/**
 * Builds kind, teacher-only feedback from already-confirmed evidence. This is
 * intentionally pure: the confirmation screen and future student timeline
 * both receive the same profile snapshot rather than independent scoring.
 */
export function buildFeedbackSummary({
  profile,
  thisAssessmentEvents,
  untrackedMisses = 0,
}: {
  profile: StudentProfile;
  thisAssessmentEvents: readonly SkillEvidenceEvent[];
  untrackedMisses?: number;
}): FeedbackSummary {
  const missesBySkill = new Map<SkillId, SkillEvidenceEvent[]>();
  for (const event of thisAssessmentEvents) {
    if (event.outcome === "correct") continue;
    const events = missesBySkill.get(event.skillId) ?? [];
    events.push(event);
    missesBySkill.set(event.skillId, events);
  }

  const thisRead = [...missesBySkill.entries()]
    .map(([skillId, events]) => ({
      count: events.length,
      detail: errorDetail(events),
      skillId,
      skillName: readingSkillById[skillId].displayName,
    }))
    .sort((left, right) => right.count - left.count || left.skillId.localeCompare(right.skillId));

  const standings = (Object.entries(profile.skills) as Array<[SkillId, StudentSkillProfile]>)
    .filter(([, skill]) => skill.accuracy.nEffective > 0)
    .map(([skillId, skill]) => standingFor(skillId, skill));
  const cumulative = [...standings].sort(
    (left, right) =>
      profile.skills[left.skillId].accuracy.lcb90 - profile.skills[right.skillId].accuracy.lcb90 ||
      left.skillId.localeCompare(right.skillId),
  );
  const strengths = [...standings]
    .sort(
      (left, right) =>
        profile.skills[right.skillId].accuracy.lcb90 - profile.skills[left.skillId].accuracy.lcb90 ||
        left.skillId.localeCompare(right.skillId),
    )
    .slice(0, 2);
  const totalEffectiveEvidence = standings.reduce((total, standing) => total + standing.chances, 0);

  return {
    confidenceNote:
      totalEffectiveEvidence < 4
        ? "Early days — two more readings will sharpen this picture."
        : undefined,
    cumulative,
    strengths,
    thisRead,
    untrackedMisses: Math.max(0, Math.floor(untrackedMisses)),
  };
}
