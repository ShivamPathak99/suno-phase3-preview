import type { MathItem } from "./item-generator";

/** Frozen sentinel passage; it preserves the existing database tables. */
export const mathInstrumentPassageId = "20000000-0000-4000-8000-000000000011";

export type MathCheckPurpose = "diagnostic" | "practice_check";

export type MathCheckAnswer = {
  answer: number;
  itemId: string;
};

export type MathCheckDraft = {
  _adaptive: {
    purpose: MathCheckPurpose;
    subject: "math";
  };
  answers: MathCheckAnswer[];
  elapsedSec?: number;
  items: MathItem[];
  purpose: MathCheckPurpose;
  seed: string;
  subject: "math";
  v: "math-check.v1";
};

export type CompleteMathCheckInput = {
  answers: readonly MathCheckAnswer[];
  elapsedSec: number;
};

export function createMathCheckDraft({
  items,
  purpose = "diagnostic",
  seed,
}: {
  items: readonly MathItem[];
  purpose?: MathCheckPurpose;
  seed: string;
}): MathCheckDraft {
  if (items.length === 0) {
    throw new Error("A math check needs at least one generated item.");
  }

  return {
    _adaptive: { purpose, subject: "math" },
    answers: [],
    items: [...items],
    purpose,
    seed,
    subject: "math",
    v: "math-check.v1",
  };
}

/** Validates an answer set against the server-stored item IDs, not client items. */
export function completeMathCheck(
  draft: MathCheckDraft,
  { answers, elapsedSec }: CompleteMathCheckInput,
): MathCheckDraft {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) {
    throw new Error("Math check elapsedSec must be a non-negative number.");
  }

  const expectedItemIds = new Set(draft.items.map((item) => item.id));
  const suppliedItemIds = new Set<string>();
  for (const answer of answers) {
    if (
      !answer ||
      typeof answer.itemId !== "string" ||
      !Number.isInteger(answer.answer) ||
      answer.answer < 0 ||
      !expectedItemIds.has(answer.itemId) ||
      suppliedItemIds.has(answer.itemId)
    ) {
      throw new Error("Math check answers must match each generated item exactly once.");
    }
    suppliedItemIds.add(answer.itemId);
  }

  if (suppliedItemIds.size !== expectedItemIds.size) {
    throw new Error("Math check needs one answer for every generated item.");
  }

  return { ...draft, answers: [...answers], elapsedSec };
}

export function isMathCheckDraft(value: unknown): value is MathCheckDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const draft = value as Partial<MathCheckDraft>;
  return (
    draft.v === "math-check.v1" &&
    draft.subject === "math" &&
    (draft.purpose === "diagnostic" || draft.purpose === "practice_check") &&
    Array.isArray(draft.items) &&
    Array.isArray(draft.answers)
  );
}
