import { mathBugIds, type BugId } from "./bug-catalog";
import type { MathCheckDraft } from "./check-contract";
import type { MathResponse, MathReviewTag } from "./diagnosis";

export type MathReviewUpdate = {
  itemId: string;
  reviewTag: MathReviewTag;
};

function isReviewTag(value: unknown): value is MathReviewTag {
  return value === "slip" || value === "dismiss" || mathBugIds.includes(value as BugId);
}

/** Rebuilds responses only from server-stored items and answers. */
export function buildReviewedMathResponses(
  draft: MathCheckDraft,
  updates: readonly MathReviewUpdate[],
): MathResponse[] {
  if (draft.answers.length !== draft.items.length) {
    throw new Error("This math check is incomplete and cannot be reviewed.");
  }

  const answerByItemId = new Map(draft.answers.map((answer) => [answer.itemId, answer.answer]));
  const itemIds = new Set(draft.items.map((item) => item.id));
  const reviewByItemId = new Map<string, MathReviewTag>();
  for (const update of updates) {
    if (!itemIds.has(update.itemId)) {
      throw new Error(`Review item ${update.itemId} does not belong to this math check.`);
    }
    if (!isReviewTag(update.reviewTag)) {
      throw new Error(`Review tag for ${update.itemId} is invalid.`);
    }
    if (reviewByItemId.has(update.itemId)) {
      throw new Error(`Review item ${update.itemId} may be tagged only once.`);
    }
    reviewByItemId.set(update.itemId, update.reviewTag);
  }

  return draft.items.map((item) => {
    const answer = answerByItemId.get(item.id);
    if (answer === undefined) {
      throw new Error(`Math check is missing the answer for ${item.id}.`);
    }

    return { answer, item, reviewTag: reviewByItemId.get(item.id) };
  });
}
