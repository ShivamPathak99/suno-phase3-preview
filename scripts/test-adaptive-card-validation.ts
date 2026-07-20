import assert from "node:assert/strict";

import {
  curatedCardCatalog,
  getCuratedCardsForSkill,
} from "../src/lib/adaptive/card-catalog";
import {
  AdaptiveCardValidationError,
  validateAdaptiveCard,
} from "../src/lib/adaptive/validation";
import { readingSkillCatalog } from "../src/lib/adaptive/skills-catalog";

assert.equal(curatedCardCatalog.length, readingSkillCatalog.length * 3);

for (const skill of readingSkillCatalog) {
  const cards = getCuratedCardsForSkill(skill.id);
  assert.equal(cards.length, 3, `${skill.id} must have three curated variants.`);

  for (const card of cards) {
    assert.equal(validateAdaptiveCard(card).cardId, card.cardId);
  }
}

assert.ok(curatedCardCatalog.some((card) => card.title === "Shyam Shops"));
assert.ok(curatedCardCatalog.some((card) => card.title === "A Fish in the Dish"));

const baseCard = getCuratedCardsForSkill("en.digraph.sh")[0];
assert.ok(baseCard);
const repeatedTargetCard = getCuratedCardsForSkill("en.hfw.the")[0];
assert.ok(repeatedTargetCard);

function expectInvalid(
  fixtureName: string,
  value: unknown,
  expectedCode: AdaptiveCardValidationError["code"],
  expected?: Parameters<typeof validateAdaptiveCard>[1],
) {
  assert.throws(
    () => validateAdaptiveCard(value, expected),
    (error: unknown) =>
      error instanceof AdaptiveCardValidationError &&
      error.code === expectedCode &&
      error.message.includes(fixtureName),
    `${fixtureName} must fail with ${expectedCode}.`,
  );
}

expectInvalid(
  "target count",
  {
    ...baseCard,
    tokens: baseCard.tokens.map((token, index) =>
      index === 3
        ? token
        : { ...token, controlledExemplar: false, primarySkillId: undefined, role: "neutral" },
    ),
  },
  "target_count",
);

expectInvalid("word count", { ...baseCard, body: "Fish." }, "word_count");
expectInvalid("question", { ...baseCard, question: "What did Shyam see" }, "question");
expectInvalid("token metadata", { ...baseCard, tokens: [] }, "token_count");
expectInvalid(
  "distinct target",
  {
    ...repeatedTargetCard,
    tokens: repeatedTargetCard.tokens.map((token) =>
      token.normalizedText === "there"
        ? { ...token, controlledExemplar: false, primarySkillId: undefined, role: "neutral" }
        : token,
    ),
  },
  "distinct_target_count",
);
expectInvalid(
  "token metadata index",
  {
    ...baseCard,
    tokens: baseCard.tokens.map((token, index) => (index === 0 ? { ...token, index: 4 } : token)),
  },
  "token_index",
);
expectInvalid("level mismatch", baseCard, "level_mismatch", { level: "paragraph" });
expectInvalid(
  "language mismatch",
  baseCard,
  "language_mismatch",
  { language: "hi" },
);

console.log(
  "P2-T9 card validation passed: curated variants and corrupted-card reasons are deterministic.",
);
