import { adaptiveConfig } from "../config";
import { bugCatalog, mathBugIds, type BugId, type MathBugItem } from "./bug-catalog";
import { type MathSkillId } from "./skills-catalog";

/** A generated item is self-contained so it can be stored and replayed exactly. */
export type MathItem = MathBugItem & {
  answer: number;
  bugPredictions: Partial<Record<BugId, number>>;
  id: string;
  skillId: MathSkillId;
};

export type PracticeSetInput = {
  focusSkillId: MathSkillId;
  secureSkillIds: readonly MathSkillId[];
  seed: string;
};

type Random = () => number;

function seededRandom(seed: string): Random {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16_777_619);
  }

  return () => {
    state += 1_832_156_581;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInt(random: Random, minimum: number, maximum: number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function digits(value: number) {
  return { tens: Math.floor(value / 10) % 10, units: value % 10 };
}

function operationForSkill(skillId: MathSkillId): MathItem["op"] {
  return skillId.startsWith("math.add.") ? "+" : "-";
}

function answerFor(a: number, b: number, op: MathItem["op"]) {
  return op === "+" ? a + b : a - b;
}

function bugPredictionsFor(item: Omit<MathItem, "bugPredictions">) {
  return Object.fromEntries(
    mathBugIds
      .filter((bugId) => bugCatalog[bugId].operation === item.op)
      .map((bugId) => [bugId, bugCatalog[bugId].pred(item)]),
  ) as Partial<Record<BugId, number>>;
}

function makeItem({
  a,
  b,
  id,
  skillId,
}: {
  a: number;
  b: number;
  id: string;
  skillId: MathSkillId;
}): MathItem {
  const op = operationForSkill(skillId);
  const item: MathItem = {
    a,
    answer: answerFor(a, b, op),
    b,
    bugPredictions: {},
    id,
    op,
    skillId,
  };
  item.bugPredictions = bugPredictionsFor(item);
  assertMathItem(item);
  return item;
}

function operandsFor(skillId: MathSkillId, random: Random) {
  const { maximumDigit, minimumTwoDigit } = adaptiveConfig.math.generator;

  switch (skillId) {
    case "math.add.facts20": {
      const a = randomInt(random, 1, maximumDigit);
      return { a, b: randomInt(random, 1, maximumDigit) };
    }
    case "math.add.no_carry": {
      const tensA = randomInt(random, 1, maximumDigit - 1);
      const tensB = randomInt(random, 1, maximumDigit - tensA);
      const unitsA = randomInt(random, 0, maximumDigit);
      const unitsB = randomInt(random, 0, maximumDigit - unitsA);
      return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
    }
    case "math.add.carry": {
      const tensA = randomInt(random, 1, maximumDigit - 2);
      const tensB = randomInt(random, 1, maximumDigit - 1 - tensA);
      const unitsA = randomInt(random, 1, maximumDigit);
      const unitsB = randomInt(random, minimumTwoDigit - unitsA, maximumDigit);
      return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
    }
    case "math.sub.facts20": {
      const a = randomInt(random, 2, maximumDigit);
      return { a, b: randomInt(random, 1, a - 1) };
    }
    case "math.sub.no_borrow": {
      const tensA = randomInt(random, 2, maximumDigit);
      const tensB = randomInt(random, 1, tensA - 1);
      const unitsA = randomInt(random, 0, maximumDigit);
      const unitsB = randomInt(random, 0, unitsA);
      return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
    }
    case "math.sub.borrow": {
      const tensA = randomInt(random, 2, maximumDigit);
      const tensB = randomInt(random, 1, tensA - 1);
      const unitsA = randomInt(random, 0, maximumDigit - 1);
      const unitsB = randomInt(random, unitsA + 1, maximumDigit);
      return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
    }
  }
}

/** Generates the same valid item for the same skill, seed, and item index. */
export function generateMathItem(skillId: MathSkillId, seed: string, index: number): MathItem {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Math item index must be a non-negative integer.");
  }

  const { a, b } = operandsFor(skillId, seededRandom(`${seed}:${skillId}:${index}`));
  return makeItem({ a, b, id: `${skillId}:${seed}:${index}`, skillId });
}

/**
 * Validates arithmetic, the B3 skill space, and every generated bug value.
 * This runs during generation as well as in property tests.
 */
export function assertMathItem(item: MathItem) {
  const { factsMaximumResult, maximumDigit, maximumTwoDigit, minimumTwoDigit } =
    adaptiveConfig.math.generator;
  if (
    !Number.isInteger(item.a) ||
    !Number.isInteger(item.b) ||
    item.a < 0 ||
    item.b < 0 ||
    item.a > maximumTwoDigit ||
    item.b > maximumTwoDigit
  ) {
    throw new Error(`Invalid operands for ${item.id}.`);
  }

  if (item.answer !== answerFor(item.a, item.b, item.op)) {
    throw new Error(`Arithmetic assertion failed for ${item.id}.`);
  }

  const aDigits = digits(item.a);
  const bDigits = digits(item.b);
  switch (item.skillId) {
    case "math.add.facts20":
      if (
        item.op !== "+" ||
        item.a > maximumDigit ||
        item.b > maximumDigit ||
        item.answer > factsMaximumResult
      ) {
        throw new Error(`facts20 addition constraint failed for ${item.id}.`);
      }
      break;
    case "math.add.no_carry":
      if (
        item.op !== "+" ||
        item.a < minimumTwoDigit ||
        item.b < minimumTwoDigit ||
        aDigits.units + bDigits.units > maximumDigit
      ) {
        throw new Error(`No-carry addition constraint failed for ${item.id}.`);
      }
      break;
    case "math.add.carry":
      if (
        item.op !== "+" ||
        aDigits.units + bDigits.units < minimumTwoDigit ||
        aDigits.tens + bDigits.tens + 1 > maximumDigit
      ) {
        throw new Error(`Carry addition constraint failed for ${item.id}.`);
      }
      break;
    case "math.sub.facts20":
      if (item.op !== "-" || item.a > maximumDigit || item.b > maximumDigit || item.a <= item.b) {
        throw new Error(`facts20 subtraction constraint failed for ${item.id}.`);
      }
      break;
    case "math.sub.no_borrow":
      if (
        item.op !== "-" ||
        item.a < minimumTwoDigit ||
        item.a <= item.b ||
        aDigits.units < bDigits.units ||
        (item.b < minimumTwoDigit && item.b !== 0)
      ) {
        throw new Error(`No-borrow subtraction constraint failed for ${item.id}.`);
      }
      break;
    case "math.sub.borrow":
      if (
        item.op !== "-" ||
        item.a < minimumTwoDigit ||
        item.a <= item.b ||
        aDigits.units >= bDigits.units ||
        (item.b < minimumTwoDigit && !(aDigits.units === 0 && item.b > 0))
      ) {
        throw new Error(`Borrow subtraction constraint failed for ${item.id}.`);
      }
      break;
  }

  for (const [bugId, prediction] of Object.entries(item.bugPredictions) as Array<[BugId, number]>) {
    const bug = bugCatalog[bugId];
    if (bug.operation !== item.op || prediction !== bug.pred(item)) {
      throw new Error(`Bug prediction assertion failed for ${item.id}: ${bugId}.`);
    }
  }
}

/** True only when every operation-relevant bug predicts a different wrong answer. */
export function isMutuallyDistinguishing(item: MathItem) {
  const predictions = Object.values(item.bugPredictions);
  return (
    predictions.length > 1 &&
    predictions.every((prediction) => prediction !== item.answer) &&
    new Set(predictions).size === predictions.length
  );
}

function distinguishingItem(skillId: "math.add.carry" | "math.sub.borrow", seed: string, offset: number) {
  for (
    let attempt = 0;
    attempt < adaptiveConfig.math.generator.distinguishingSearchAttempts;
    attempt += 1
  ) {
    const item = generateMathItem(skillId, seed, offset + attempt);
    if (isMutuallyDistinguishing(item)) {
      return item;
    }
  }

  throw new Error(`Could not generate a distinguishing ${skillId} probe item.`);
}

/** Generates the fixed eight-item V1 probe, ordered from facts toward two-digit work. */
export function generateProbeItems(seed: string): MathItem[] {
  const items = [
    generateMathItem("math.add.facts20", seed, 0),
    generateMathItem("math.sub.facts20", seed, 1),
    generateMathItem("math.add.no_carry", seed, 2),
    makeItem({
      a: 30,
      b: 0,
      id: `math.sub.no_borrow:${seed}:zero-template`,
      skillId: "math.sub.no_borrow",
    }),
    distinguishingItem("math.add.carry", seed, 100),
    makeItem({
      a: 40,
      b: 7,
      id: `math.sub.borrow:${seed}:zero-template`,
      skillId: "math.sub.borrow",
    }),
    distinguishingItem("math.add.carry", seed, 200),
    generateMathItem("math.sub.borrow", seed, 7),
  ];

  if (
    items.filter(isMutuallyDistinguishing).length <
    adaptiveConfig.math.probe.minimumMutuallyDistinguishingItems
  ) {
    throw new Error("Math probe is missing its required distinguishing items.");
  }

  return items;
}

/** Generates a 7-secure / 3-focus sheet with targets always separated by secure work. */
export function generatePracticeSet({
  focusSkillId,
  secureSkillIds,
  seed,
}: PracticeSetInput): MathItem[] {
  const secure = secureSkillIds.filter((skillId) => skillId !== focusSkillId);
  if (secure.length === 0) {
    throw new Error("A practice sheet needs at least one secure skill distinct from its focus.");
  }

  const slotPlan: Array<"focus" | "secure"> = [
    "secure",
    "secure",
    "focus",
    "secure",
    "secure",
    "focus",
    "secure",
    "secure",
    "focus",
    "secure",
  ];
  const items = slotPlan.map((slot, index) => {
    const skillId =
      slot === "focus" ? focusSkillId : secure[index % secure.length] ?? secure[0]!;
    return generateMathItem(skillId, `${seed}:practice`, index);
  });

  const focusCount = items.filter((item) => item.skillId === focusSkillId).length;
  if (
    items.length !== adaptiveConfig.math.practice.totalItems ||
    focusCount !== adaptiveConfig.math.practice.focusItems ||
    items.length - focusCount !== adaptiveConfig.math.practice.secureItems
  ) {
    throw new Error("Practice-set composition must be exactly 7 secure and 3 focus items.");
  }

  return items;
}
