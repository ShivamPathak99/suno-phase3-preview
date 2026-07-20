import type { TokenMeta } from "./passage-catalog";
import type { AdaptiveCard } from "./types";

export type StoredAdaptiveWorksheet = {
  adaptive: AdaptiveCard;
  content: {
    body: string;
    question: string;
    title: string;
    warmUpWords: string[];
  };
  studentId: string;
  tokens: TokenMeta[];
  v: "adaptive-worksheet.v1";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is TokenMeta {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.index === "number" &&
    typeof value.normalizedText === "string" &&
    (value.role === "target" || value.role === "support" || value.role === "neutral") &&
    (value.primarySkillId === undefined || typeof value.primarySkillId === "string") &&
    typeof value.controlledExemplar === "boolean"
  );
}

/**
 * Reads only the adaptive-card JSON that P2-T10 owns.  A worksheet created by
 * the existing GPT route deliberately cannot be rendered through this path.
 */
export function parseStoredAdaptiveWorksheet(value: unknown): StoredAdaptiveWorksheet | null {
  if (!isRecord(value) || value.v !== "adaptive-worksheet.v1") {
    return null;
  }

  const { adaptive, content, studentId, tokens } = value;

  if (!isRecord(adaptive) || adaptive.v !== "adaptive-card.v1" || !isRecord(content)) {
    return null;
  }

  if (
    typeof adaptive.cardId !== "string" ||
    typeof adaptive.focusSkillId !== "string" ||
    (adaptive.mode !== "individual" && adaptive.mode !== "group") ||
    typeof adaptive.passageId !== "string" ||
    typeof adaptive.reason !== "string" ||
    !isRecord(adaptive.evidenceSummary) ||
    !isRecord(adaptive.qualityChecks) ||
    typeof content.body !== "string" ||
    typeof content.question !== "string" ||
    typeof content.title !== "string" ||
    !Array.isArray(content.warmUpWords) ||
    !content.warmUpWords.every((word) => typeof word === "string") ||
    typeof studentId !== "string" ||
    !Array.isArray(tokens) ||
    !tokens.every(isToken)
  ) {
    return null;
  }

  return value as StoredAdaptiveWorksheet;
}

export function adaptivePracticePath(worksheetId: string, view: "child" | "teacher" = "teacher") {
  const encodedWorksheetId = encodeURIComponent(worksheetId);

  return view === "child"
    ? `/practice/${encodedWorksheetId}?view=child`
    : `/practice/${encodedWorksheetId}`;
}

/** The purpose is threaded into capture/confirm in P2-T12. */
export function focusedReadNowPath(studentId: string, passageId: string) {
  return (
    "/assess/" +
    encodeURIComponent(studentId) +
    "?passageId=" +
    encodeURIComponent(passageId) +
    "&purpose=focused_readback"
  );
}
