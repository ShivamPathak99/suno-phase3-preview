import type { FocusRecommendation } from "./selection";

export const focusPanelDebugModes = [
  "focus",
  "general",
  "cold-start",
  "strategy-needed",
] as const;

export type FocusPanelDebugMode = (typeof focusPanelDebugModes)[number];

/**
 * Server-safe visual fixtures for the four teacher-facing focus panel states.
 * They deliberately live outside the component so each state can be opened at
 * `/assess/mock-reader?mock=confirm&debug=<state>` without a network call.
 */
export function parseFocusPanelDebugMode(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  return (focusPanelDebugModes as readonly string[]).includes(value)
    ? (value as FocusPanelDebugMode)
    : undefined;
}

export function getFocusPanelDebugRecommendation(
  mode: FocusPanelDebugMode,
  studentName: string,
): FocusRecommendation {
  switch (mode) {
    case "focus":
      return {
        evidenceSummary: { errors: 3, hesitations: 2, opportunities: 9, readings: 2 },
        kind: "focused_card",
        need: 0.61,
        reason: "3 substitutions and 2 hesitations across 9 chances in 2 readings.",
        skillId: "en.digraph.sh",
        source: "algorithmic",
      };
    case "general":
      return {
        kind: "general_card",
        reason: `${studentName} is solid across current targets -- keep reading widely.`,
        source: "general",
      };
    case "cold-start":
      return {
        kind: "general_card",
        reason: `Suno is still learning about ${studentName} -- here's a solid word-level card.`,
        source: "cold_start",
      };
    case "strategy-needed":
      return {
        alternatives: ["teacher-led blending", "smaller group", "picture support"],
        kind: "teacher_strategy_needed",
        reason:
          "sh words has had three focused cards without an LCB improvement. Try teacher-led blending, a smaller group, or picture support.",
        skillId: "en.digraph.sh",
        source: "strategy_needed",
      };
  }
}
