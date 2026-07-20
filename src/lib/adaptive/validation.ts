import { adaptiveConfig } from "./config";
import type { CuratedCard, CuratedCardLevel } from "./card-catalog";
import type { TokenMeta } from "./passage-catalog";
import { readingSkillById, type SkillId } from "./skills-catalog";

export type AdaptiveCardValidationCode =
  | "card_shape"
  | "distinct_target_count"
  | "focus_skill"
  | "focus_skill_mismatch"
  | "language"
  | "language_mismatch"
  | "level"
  | "level_mismatch"
  | "question"
  | "target_count"
  | "target_tagging"
  | "token_count"
  | "token_index"
  | "token_role"
  | "token_text"
  | "warm_up_words"
  | "word_count";

export class AdaptiveCardValidationError extends Error {
  constructor(
    public readonly code: AdaptiveCardValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "AdaptiveCardValidationError";
  }
}

export type AdaptiveCardRequestConstraints = {
  focusSkillId?: SkillId;
  language?: "en" | "hi";
  level?: CuratedCardLevel;
};

export type AdaptiveCardQualityChecks = {
  distinctTargets: number;
  passed: true;
  targetCount: number;
  wordCount: number;
};

export type ValidatedAdaptiveCard = CuratedCard & {
  qualityChecks: AdaptiveCardQualityChecks;
};

const allowedRoles = new Set<TokenMeta["role"]>(["target", "support", "neutral"]);

function fail(code: AdaptiveCardValidationCode, message: string): never {
  throw new AdaptiveCardValidationError(code, message);
}

/** Counts Unicode words while keeping the metadata matching rules deterministic. */
export function tokenizeAdaptiveCardText(text: string) {
  return text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

export function normalizeAdaptiveCardToken(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("en-US");
}

/**
 * Builds full body-token metadata for a curated card. The catalog supplies
 * only the reviewed direct target words; every remaining token is explicitly
 * neutral so a read-back can never multi-diagnose an untagged pattern.
 */
export function createFocusedCardTokens(
  body: string,
  focusSkillId: SkillId,
  targetWords: readonly string[],
): TokenMeta[] {
  const targetWordsByNormalizedValue = new Set(
    targetWords.map((word) => normalizeAdaptiveCardToken(word)),
  );

  return tokenizeAdaptiveCardText(body).map((word, index) => {
    const normalizedText = normalizeAdaptiveCardToken(word);
    const isTarget = targetWordsByNormalizedValue.has(normalizedText);

    return {
      controlledExemplar: isTarget,
      index,
      normalizedText,
      primarySkillId: isTarget ? focusSkillId : undefined,
      role: isTarget ? "target" : "neutral",
    };
  });
}

function hasOneTrailingQuestion(question: string) {
  const marks = question.match(/\?/gu)?.length ?? 0;
  return marks === 1 && /\?\s*$/u.test(question) && tokenizeAdaptiveCardText(question).length > 0;
}

function isCardLevel(value: unknown): value is CuratedCardLevel {
  return value === "word" || value === "paragraph";
}

function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && value in readingSkillById;
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Enforces the Phase 2 curated-card contract before a card can become a
 * practice passage. It is deliberately synchronous, pure, and deterministic.
 */
export function validateAdaptiveCard(
  value: unknown,
  expected: AdaptiveCardRequestConstraints = {},
): ValidatedAdaptiveCard {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("card_shape", "Card shape must be an object.");
  }

  const card = value as Partial<CuratedCard>;

  if (card.language !== "en") {
    return fail("language", "Card language must be en.");
  }
  if (!isCardLevel(card.level)) {
    return fail("level", "Card level must be word or paragraph.");
  }
  if (!isSkillId(card.focusSkillId)) {
    return fail("focus_skill", "Card focus skill must be a known V1 reading skill.");
  }
  if (typeof card.cardId !== "string" || !card.cardId.trim()) {
    return fail("card_shape", "Card shape requires a non-empty cardId.");
  }
  if (typeof card.title !== "string" || !card.title.trim()) {
    return fail("card_shape", "Card shape requires a non-empty title.");
  }
  if (typeof card.body !== "string" || !card.body.trim()) {
    return fail("card_shape", "Card shape requires a non-empty body.");
  }
  if (typeof card.question !== "string" || !card.question.trim()) {
    return fail("question", "Card question must contain exactly one trailing question mark.");
  }

  if (expected.language && card.language !== expected.language) {
    return fail("language_mismatch", "Card language mismatch for this request.");
  }
  if (expected.level && card.level !== expected.level) {
    return fail("level_mismatch", "Card level mismatch for this request.");
  }
  if (expected.focusSkillId && card.focusSkillId !== expected.focusSkillId) {
    return fail("focus_skill_mismatch", "Card focus skill mismatch for this request.");
  }

  const wordCount = tokenizeAdaptiveCardText(card.body).length;
  const wordCountBand = adaptiveConfig.content.card.wordCountByLevel[card.level];
  if (wordCount < wordCountBand.minimum || wordCount > wordCountBand.maximum) {
    return fail(
      "word_count",
      `Card word count must be ${wordCountBand.minimum}-${wordCountBand.maximum}; received ${wordCount}.`,
    );
  }

  if (card.body.includes("?") || !hasOneTrailingQuestion(card.question)) {
    return fail("question", "Card question must contain exactly one trailing question mark.");
  }

  if (!hasStringArray(card.warmUpWords)) {
    return fail("warm_up_words", "Card warm-up words must be a string array.");
  }
  const warmUpWords = card.warmUpWords.map((word) => normalizeAdaptiveCardToken(word));
  if (
    warmUpWords.length < adaptiveConfig.content.card.warmUpWords.minimum ||
    warmUpWords.length > adaptiveConfig.content.card.warmUpWords.maximum ||
    warmUpWords.some((word) => !word) ||
    new Set(warmUpWords).size !== warmUpWords.length
  ) {
    return fail(
      "warm_up_words",
      `Card warm-up words must contain ${adaptiveConfig.content.card.warmUpWords.minimum}-${adaptiveConfig.content.card.warmUpWords.maximum} distinct words.`,
    );
  }

  if (!Array.isArray(card.tokens)) {
    return fail("token_count", "Card token metadata must be an array covering every body word.");
  }

  const bodyTokens = tokenizeAdaptiveCardText(card.body).map(normalizeAdaptiveCardToken);
  if (card.tokens.length !== bodyTokens.length) {
    return fail(
      "token_count",
      `Card token metadata must contain ${bodyTokens.length} tokens; received ${card.tokens.length}.`,
    );
  }

  for (const [index, token] of card.tokens.entries()) {
    if (typeof token !== "object" || token === null || Array.isArray(token)) {
      return fail("token_count", "Card token metadata must contain token objects.");
    }
    if (token.index !== index) {
      return fail("token_index", `Card token metadata index ${index} is not contiguous.`);
    }
    if (!allowedRoles.has(token.role)) {
      return fail("token_role", `Card token metadata index ${index} has no valid role.`);
    }
    if (token.normalizedText !== bodyTokens[index]) {
      return fail("token_text", `Card token metadata index ${index} does not match the body word.`);
    }

    const isDirectTarget = token.role === "target";
    if (
      (isDirectTarget && (!token.controlledExemplar || token.primarySkillId !== card.focusSkillId)) ||
      (token.controlledExemplar && !isDirectTarget) ||
      (token.primarySkillId !== undefined && token.primarySkillId !== card.focusSkillId)
    ) {
      return fail(
        "target_tagging",
        `Card token metadata index ${index} must tag only direct ${card.focusSkillId} targets.`,
      );
    }
  }

  const targetTokens = card.tokens.filter((token) => token.role === "target");
  if (
    targetTokens.length < adaptiveConfig.content.card.targetOccurrences.minimum ||
    targetTokens.length > adaptiveConfig.content.card.targetOccurrences.maximum
  ) {
    return fail(
      "target_count",
      `Card target count must be ${adaptiveConfig.content.card.targetOccurrences.minimum}-${adaptiveConfig.content.card.targetOccurrences.maximum}; received ${targetTokens.length}.`,
    );
  }

  const distinctTargets = new Set(targetTokens.map((token) => token.normalizedText)).size;
  if (distinctTargets < adaptiveConfig.content.card.targetWordTypes.minimum) {
    return fail(
      "distinct_target_count",
      `Card needs at least ${adaptiveConfig.content.card.targetWordTypes.minimum} distinct target words; received ${distinctTargets}.`,
    );
  }

  return {
    ...(card as CuratedCard),
    qualityChecks: {
      distinctTargets,
      passed: true,
      targetCount: targetTokens.length,
      wordCount,
    },
  };
}
