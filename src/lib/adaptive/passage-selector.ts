import type { ReadingLevel } from "@/lib/assessment-types";

export const benchmarkPassageSelectionConfig = {
  noRepeatCount: 2,
  noRepeatDays: 21,
} as const;

export type BenchmarkPoolPassage = {
  id: string;
  language: "en" | "hi";
  level: ReadingLevel;
  source: "baseline" | "other";
};

export type BenchmarkPassageHistory = {
  occurredAt: string;
  passageId: string;
};

export type BenchmarkPassageSelection = {
  eligiblePassageIds: string[];
  fallback: boolean;
  passage: BenchmarkPoolPassage;
};

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function newestFirst(left: BenchmarkPassageHistory, right: BenchmarkPassageHistory) {
  const occurredOrder = right.occurredAt.localeCompare(left.occurredAt);
  return occurredOrder !== 0 ? occurredOrder : right.passageId.localeCompare(left.passageId);
}

function leastRecentlyReadFirst(
  readByPassageId: ReadonlyMap<string, string>,
  left: BenchmarkPoolPassage,
  right: BenchmarkPoolPassage,
) {
  const leftRead = readByPassageId.get(left.id) ?? "";
  const rightRead = readByPassageId.get(right.id) ?? "";

  if (leftRead !== rightRead) {
    // An unread form is the least-recently-read form by definition.
    if (!leftRead) return -1;
    if (!rightRead) return 1;
    return leftRead.localeCompare(rightRead);
  }

  return left.id.localeCompare(right.id);
}

function daysSince(then: string, now: string) {
  const milliseconds = Date.parse(now) - Date.parse(then);
  return Number.isFinite(milliseconds) ? milliseconds / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
}

/**
 * Picks a parallel benchmark form without rerolling on refresh. The optional
 * `selectionOffset` is the teacher's deterministic Change-passage action — it
 * advances through the same eligible ordering, never randomizes it.
 */
export function pickBenchmarkPassage({
  benchmarkCount,
  history,
  language,
  level,
  now = new Date().toISOString(),
  pool,
  selectionOffset = 0,
  studentId,
}: {
  benchmarkCount: number;
  history: readonly BenchmarkPassageHistory[];
  language: "en" | "hi";
  level: ReadingLevel;
  now?: string;
  pool: readonly BenchmarkPoolPassage[];
  selectionOffset?: number;
  studentId: string;
}): BenchmarkPassageSelection | null {
  const candidates = pool
    .filter(
      (passage) =>
        passage.language === language && passage.level === level && passage.source === "baseline",
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  if (candidates.length === 0) return null;

  const scopedHistory = [...history].sort(newestFirst);
  const lastPassageIds = new Set(
    scopedHistory.slice(0, benchmarkPassageSelectionConfig.noRepeatCount).map((entry) => entry.passageId),
  );
  const recentPassageIds = new Set(
    scopedHistory
      .filter((entry) => daysSince(entry.occurredAt, now) <= benchmarkPassageSelectionConfig.noRepeatDays)
      .map((entry) => entry.passageId),
  );
  const eligible = candidates.filter(
    (passage) => !lastPassageIds.has(passage.id) && !recentPassageIds.has(passage.id),
  );
  const safeOffset = Number.isInteger(selectionOffset) && selectionOffset > 0 ? selectionOffset : 0;
  const seededIndex = stableHash(`${studentId}:${benchmarkCount}`);

  if (eligible.length > 0) {
    const index = (seededIndex + safeOffset) % eligible.length;
    return {
      eligiblePassageIds: eligible.map((passage) => passage.id),
      fallback: false,
      passage: eligible[index]!,
    };
  }

  const lastReadByPassageId = new Map<string, string>();
  for (const entry of scopedHistory) {
    const previous = lastReadByPassageId.get(entry.passageId);
    if (!previous || entry.occurredAt > previous) {
      lastReadByPassageId.set(entry.passageId, entry.occurredAt);
    }
  }
  const fallbackCandidates = [...candidates].sort((left, right) =>
    leastRecentlyReadFirst(lastReadByPassageId, left, right),
  );
  const index = safeOffset % fallbackCandidates.length;

  return {
    eligiblePassageIds: fallbackCandidates.map((passage) => passage.id),
    fallback: true,
    passage: fallbackCandidates[index]!,
  };
}
