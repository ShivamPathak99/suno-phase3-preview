import { adaptiveConfig } from "./config";
import type { SkillEvidenceEvent } from "./evidence";
import { readingSkillCatalog, type Skill, type SkillId } from "./skills-catalog";
import type { Subject } from "./types";

export type SkillState =
  | "locked"
  | "new"
  | "active"
  | "reinforce"
  | "review_due"
  | "mastered"
  | "teacher_hold";

export type BetaPosterior = {
  alpha: number;
  beta: number;
  lcb90: number;
  mean: number;
  nEffective: number;
};

export type StudentSkillProfile = {
  accuracy: BetaPosterior;
  automaticity: BetaPosterior;
  distinctPracticeDays: number;
  distinctWordCount: number;
  id: SkillId;
  lastEvidenceAt?: string;
  prerequisitesMet: boolean;
  recentErrorEwma: number;
  state: SkillState;
};

export type StudentProfile = {
  confirmedReadingCount: number;
  skills: Record<SkillId, StudentSkillProfile>;
  studentId: string;
};

export type BuildStudentProfileInput = {
  activeSkillIds?: readonly SkillId[];
  asOf: string;
  confirmedReadingCount?: number;
  events: readonly SkillEvidenceEvent[];
  skills?: readonly Skill[];
  studentId: string;
  subject?: Subject;
  teacherHoldSkillIds?: readonly SkillId[];
};

type SkillMetrics = Omit<StudentSkillProfile, "prerequisitesMet" | "state">;

function sortEvents(events: readonly SkillEvidenceEvent[]) {
  return [...events].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return left.occurredAt < right.occurredAt ? -1 : 1;
    }

    return left.assessmentId < right.assessmentId
      ? -1
      : left.assessmentId > right.assessmentId
        ? 1
        : 0;
  });
}

function buildPosterior(
  events: readonly SkillEvidenceEvent[],
  credit: "accuracyCredit" | "automaticityCredit",
): BetaPosterior {
  const relevantEvents = events.filter((event) => event[credit] !== undefined);
  const alpha =
    adaptiveConfig.profile.posteriorPrior.alpha +
    relevantEvents.reduce<number>(
      (total, event) =>
        total +
        adaptiveConfig.profile.recencyDecayMultiplier * event.weight * (event[credit] ?? 0),
      0,
    );
  const beta =
    adaptiveConfig.profile.posteriorPrior.beta +
    relevantEvents.reduce<number>(
      (total, event) =>
        total +
        adaptiveConfig.profile.recencyDecayMultiplier *
          event.weight *
          (1 - (event[credit] ?? 0)),
      0,
    );
  const mean = alpha / (alpha + beta);
  const standardError = Math.sqrt((mean * (1 - mean)) / (alpha + beta + 1));

  return {
    alpha,
    beta,
    lcb90: Math.max(0, mean - adaptiveConfig.profile.lcb90ZScore * standardError),
    mean,
    nEffective:
      alpha +
      beta -
      adaptiveConfig.profile.posteriorPrior.alpha -
      adaptiveConfig.profile.posteriorPrior.beta,
  };
}

function buildMetrics(skill: Skill, events: readonly SkillEvidenceEvent[]): SkillMetrics {
  const accuracy = buildPosterior(events, "accuracyCredit");
  const automaticity = buildPosterior(events, "automaticityCredit");
  const recentErrorEwma = events.reduce<number>(
    (value, event) =>
      adaptiveConfig.profile.recentErrorEwma.retainedWeight * value +
      adaptiveConfig.profile.recentErrorEwma.errorWeight * (1 - event.accuracyCredit),
    adaptiveConfig.profile.recentErrorEwma.initialValue,
  );

  return {
    accuracy,
    automaticity,
    distinctPracticeDays: new Set(events.map((event) => event.occurredAt.slice(0, 10))).size,
    distinctWordCount: new Set(events.map((event) => event.distinctWordKey)).size,
    id: skill.id,
    lastEvidenceAt: events.length > 0 ? events[events.length - 1]?.occurredAt : undefined,
    recentErrorEwma,
  };
}

function daysSince(occurredAt: string | undefined, asOf: string) {
  if (!occurredAt) {
    return 0;
  }

  const occurredAtMillis = Date.parse(occurredAt);
  const asOfMillis = Date.parse(asOf);
  if (!Number.isFinite(occurredAtMillis) || !Number.isFinite(asOfMillis)) {
    throw new Error("Profile timestamps must be valid ISO dates.");
  }

  return (asOfMillis - occurredAtMillis) / adaptiveConfig.profile.millisecondsPerDay;
}

function isMastered(skill: Skill, metrics: SkillMetrics, events: readonly SkillEvidenceEvent[]) {
  const lastEvents = events.slice(-adaptiveConfig.profile.mastery.lastEventsToInspect);
  const hasRecentHighQualityFailure = lastEvents.some(
    (event) =>
      event.accuracyCredit < adaptiveConfig.evidence.credits.correct.accuracy &&
      event.weight >= adaptiveConfig.profile.mastery.highQualityFailureWeight,
  );
  const decodeRequirementsMet =
    metrics.accuracy.nEffective >= adaptiveConfig.profile.mastery.effectiveAccuracyEvidence &&
    metrics.distinctWordCount >= adaptiveConfig.profile.mastery.distinctWords &&
    metrics.distinctPracticeDays >= adaptiveConfig.profile.mastery.minimumPracticeDays &&
    metrics.accuracy.lcb90 >= adaptiveConfig.profile.mastery.accuracyLcb90 &&
    !hasRecentHighQualityFailure;
  const automaticityRequirementsMet =
    skill.practiceMode !== "automaticity" ||
    (metrics.automaticity.nEffective >=
      adaptiveConfig.profile.mastery.effectiveFluencyEvidence &&
      metrics.automaticity.lcb90 >= adaptiveConfig.profile.mastery.automaticityLcb90);

  return decodeRequirementsMet && automaticityRequirementsMet;
}

function isReinforce(metrics: SkillMetrics) {
  return (
    metrics.accuracy.nEffective >= adaptiveConfig.profile.reinforce.minimumEffectiveEvidence &&
    metrics.recentErrorEwma >= adaptiveConfig.profile.reinforce.minimumRecentErrorEwma
  );
}

/**
 * Rebuilds the auditable per-skill profile from teacher-confirmed events.
 * `asOf` is supplied by the caller so this deterministic core never reads the
 * clock itself.
 */
export function buildStudentProfile({
  activeSkillIds = [],
  asOf,
  confirmedReadingCount,
  events,
  skills = readingSkillCatalog,
  studentId,
  subject = "reading",
  teacherHoldSkillIds = [],
}: BuildStudentProfileInput): StudentProfile {
  if (!Number.isFinite(Date.parse(asOf))) {
    throw new Error("Profile asOf must be a valid ISO date.");
  }

  const activeSkills = new Set(activeSkillIds);
  const heldSkills = new Set(teacherHoldSkillIds);
  const confirmedEvents = sortEvents(
    events.filter(
      (event) =>
        event.studentId === studentId &&
        event.teacherConfirmed &&
        (event.subject ?? "reading") === subject,
    ),
  );
  const eventsBySkill = new Map<SkillId, SkillEvidenceEvent[]>();
  for (const event of confirmedEvents) {
    const skillEvents = eventsBySkill.get(event.skillId) ?? [];
    skillEvents.push(event);
    eventsBySkill.set(event.skillId, skillEvents);
  }

  const metricsBySkill = new Map<SkillId, SkillMetrics>();
  for (const skill of skills) {
    metricsBySkill.set(skill.id, buildMetrics(skill, eventsBySkill.get(skill.id) ?? []));
  }

  const skillProfiles = {} as Record<SkillId, StudentSkillProfile>;
  for (const skill of skills) {
    const metrics = metricsBySkill.get(skill.id);
    if (!metrics) {
      throw new Error(`Missing metrics for ${skill.id}.`);
    }

    const prerequisitesMet = skill.prerequisites.every((prerequisiteId) => {
      const prerequisite = metricsBySkill.get(prerequisiteId);
      return (
        prerequisite !== undefined &&
        prerequisite.accuracy.lcb90 >= adaptiveConfig.profile.prerequisite.accuracyLcb90 &&
        prerequisite.accuracy.nEffective >= adaptiveConfig.profile.prerequisite.effectiveEvidence
      );
    });
    const skillEvents = eventsBySkill.get(skill.id) ?? [];
    const mastered = isMastered(skill, metrics, skillEvents);
    const reviewDue =
      mastered &&
      daysSince(metrics.lastEvidenceAt, asOf) >= adaptiveConfig.profile.reviewIntervalDays;
    const state: SkillState = heldSkills.has(skill.id)
      ? "teacher_hold"
      : isReinforce(metrics)
        ? "reinforce"
        : reviewDue
          ? "review_due"
          : mastered
            ? "mastered"
            : !prerequisitesMet
              ? "locked"
              : activeSkills.has(skill.id)
                ? "active"
                : "new";

    skillProfiles[skill.id] = { ...metrics, prerequisitesMet, state };
  }

  return {
    confirmedReadingCount: Math.max(
      confirmedReadingCount ?? 0,
      new Set(confirmedEvents.map((event) => event.assessmentId)).size,
    ),
    skills: skillProfiles,
    studentId,
  };
}
