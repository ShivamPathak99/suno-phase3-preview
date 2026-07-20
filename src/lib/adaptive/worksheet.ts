import { buildStudentProfile } from "./profile";
import {
  chooseFocus,
  type FocusEvidenceSummary,
  type FocusedCardRecommendation,
} from "./selection";
import { readingSkillById, type SkillId } from "./skills-catalog";
import { getCuratedCardsForSkill, type CuratedCard } from "./card-catalog";
import {
  type AdaptiveCardQualityChecks,
  validateAdaptiveCard,
} from "./validation";
import type { AdaptiveAssessmentPayload } from "./confirmation";
import type { AdaptiveCard } from "./types";

export type AdaptiveWorksheetResolutionErrorCode =
  | "no_curated_card"
  | "no_focus"
  | "skill_language"
  | "skill_level"
  | "unknown_skill";

export class AdaptiveWorksheetResolutionError extends Error {
  constructor(
    public readonly code: AdaptiveWorksheetResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdaptiveWorksheetResolutionError";
  }
}

export type AdaptiveWorksheetScope = {
  language: "en" | "hi";
  level: "letter" | "word" | "paragraph" | "story";
  studentId: string;
  studentName: string;
};

export type ResolvedAdaptiveWorksheetFocus = {
  focus: FocusedCardRecommendation;
  focusSkillId: SkillId;
};

export type AdaptiveWorksheetContent = {
  adaptive: AdaptiveCard;
  content: {
    body: string;
    question: string;
    title: string;
    warmUpWords: string[];
  };
  studentId: string;
  tokens: CuratedCard["tokens"];
  v: "adaptive-worksheet.v1";
};

export type AdaptiveWorksheetPlan = {
  card: CuratedCard;
  focus: FocusedCardRecommendation;
  qualityChecks: AdaptiveCardQualityChecks;
};

function fail(code: AdaptiveWorksheetResolutionErrorCode, message: string): never {
  throw new AdaptiveWorksheetResolutionError(code, message);
}

function mergeEvidenceSummaries(
  assessments: readonly AdaptiveAssessmentPayload[],
): Partial<Record<SkillId, FocusEvidenceSummary>> {
  const merged = {} as Partial<Record<SkillId, FocusEvidenceSummary>>;

  for (const assessment of assessments) {
    for (const [skillId, summary] of Object.entries(assessment.evidenceSummaryBySkill) as Array<
      [SkillId, FocusEvidenceSummary]
    >) {
      const current = merged[skillId] ?? {
        errors: 0,
        hesitations: 0,
        opportunities: 0,
        readings: 0,
      };
      merged[skillId] = {
        errors: current.errors + summary.errors,
        hesitations: current.hesitations + summary.hesitations,
        opportunities: current.opportunities + summary.opportunities,
        readings: current.readings + summary.readings,
      };
    }
  }

  return merged;
}

export function validateAdaptiveWorksheetFocus(
  value: string,
  scope: Pick<AdaptiveWorksheetScope, "language" | "level">,
): SkillId {
  const skill = readingSkillById[value as SkillId];

  if (!skill) {
    return fail("unknown_skill", "The requested practice focus is not available.");
  }
  if (skill.language !== scope.language) {
    return fail("skill_language", "The requested practice focus does not match this language.");
  }
  if (!skill.aserBands.includes(scope.level)) {
    return fail("skill_level", "The requested practice focus does not match this reading level.");
  }

  return skill.id;
}

/** Rebuilds the deterministic focus when a teacher did not supply an override. */
export function resolveAdaptiveWorksheetFocus({
  assessments,
  confirmedReadingCount = assessments.length,
  requestedFocusSkillId,
  scope,
}: {
  assessments: readonly AdaptiveAssessmentPayload[];
  confirmedReadingCount?: number;
  requestedFocusSkillId?: string;
  scope: AdaptiveWorksheetScope;
}): ResolvedAdaptiveWorksheetFocus {
  const evidenceSummaryBySkill = mergeEvidenceSummaries(assessments);

  if (requestedFocusSkillId) {
    const focusSkillId = validateAdaptiveWorksheetFocus(requestedFocusSkillId, scope);
    return {
      focus: {
        evidenceSummary: evidenceSummaryBySkill[focusSkillId],
        kind: "focused_card",
        reason: `You chose ${readingSkillById[focusSkillId].displayName} as the next focus.`,
        skillId: focusSkillId,
        source: "teacher_pin",
      },
      focusSkillId,
    };
  }

  const events = assessments.flatMap((assessment) => assessment.evidence);
  const asOf = events.reduce(
    (latest, event) => (event.occurredAt > latest ? event.occurredAt : latest),
    new Date(0).toISOString(),
  );
  const profile = buildStudentProfile({
    asOf,
    confirmedReadingCount,
    events,
    studentId: scope.studentId,
  });
  const recommendation = chooseFocus({
    evidenceSummaryBySkill,
    profile,
    scope: { level: scope.level, studentName: scope.studentName },
  });

  if (recommendation.kind !== "focused_card") {
    return fail(
      "no_focus",
      "Suno needs more confirmed evidence before it can create a focused practice card.",
    );
  }

  return { focus: recommendation, focusSkillId: recommendation.skillId };
}

/** Deterministically avoids only the most recently used card for this child. */
export function selectAdaptiveWorksheetCard({
  focusSkillId,
  level,
  mostRecentCardId,
}: {
  focusSkillId: SkillId;
  level: AdaptiveWorksheetScope["level"];
  mostRecentCardId?: string | null;
}): CuratedCard {
  if (level !== "word" && level !== "paragraph") {
    return fail(
      "no_curated_card",
      "No validated practice card is available for this focus and reading level.",
    );
  }

  const cards = getCuratedCardsForSkill(focusSkillId, level);
  const nonRepeatingCards = cards.filter((card) => card.cardId !== mostRecentCardId);
  const card = nonRepeatingCards[0] ?? cards[0];

  if (!card) {
    return fail(
      "no_curated_card",
      "No validated practice card is available for this focus and reading level.",
    );
  }

  return card;
}

export function planAdaptiveWorksheet({
  assessments,
  confirmedReadingCount,
  mostRecentCardId,
  requestedFocusSkillId,
  scope,
}: {
  assessments: readonly AdaptiveAssessmentPayload[];
  confirmedReadingCount?: number;
  mostRecentCardId?: string | null;
  requestedFocusSkillId?: string;
  scope: AdaptiveWorksheetScope;
}): AdaptiveWorksheetPlan {
  const resolved = resolveAdaptiveWorksheetFocus({
    assessments,
    confirmedReadingCount,
    requestedFocusSkillId,
    scope,
  });
  const card = selectAdaptiveWorksheetCard({
    focusSkillId: resolved.focusSkillId,
    level: scope.level,
    mostRecentCardId,
  });
  const validated = validateAdaptiveCard(card, {
    focusSkillId: resolved.focusSkillId,
    language: scope.language,
    level: card.level,
  });

  return { card, focus: resolved.focus, qualityChecks: validated.qualityChecks };
}

export function createAdaptiveWorksheetContent({
  card,
  focus,
  mode = "individual",
  passageId,
  qualityChecks,
  studentId,
}: {
  card: CuratedCard;
  focus: FocusedCardRecommendation;
  mode?: AdaptiveCard["mode"];
  passageId: string;
  qualityChecks: AdaptiveCardQualityChecks;
  studentId: string;
}): AdaptiveWorksheetContent {
  return {
    adaptive: {
      cardId: card.cardId,
      evidenceSummary: focus.evidenceSummary ?? {
        errors: 0,
        hesitations: 0,
        opportunities: 0,
        readings: 0,
      },
      focusSkillId: focus.skillId,
      mode,
      passageId,
      qualityChecks,
      reason: focus.reason,
      v: "adaptive-card.v1",
    },
    content: {
      body: card.body,
      question: card.question,
      title: card.title,
      warmUpWords: [...card.warmUpWords],
    },
    studentId,
    tokens: card.tokens.map((token) => ({ ...token })),
    v: "adaptive-worksheet.v1",
  };
}

export function mostRecentAdaptiveCardId(value: unknown, studentId: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const content = value as { adaptive?: unknown; studentId?: unknown };
  if (content.studentId !== studentId || typeof content.adaptive !== "object" || content.adaptive === null) {
    return null;
  }

  const adaptive = content.adaptive as { cardId?: unknown; v?: unknown };
  return adaptive.v === "adaptive-card.v1" && typeof adaptive.cardId === "string"
    ? adaptive.cardId
    : null;
}
