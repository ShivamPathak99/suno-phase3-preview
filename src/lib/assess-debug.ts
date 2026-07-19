export const assessDebugModes = [
  "mic-denied",
  "upload-failed",
  "unassessable-quiet",
  "unassessable-wrong-passage",
  "unassessable-too-fast",
  "analysis-timeout",
] as const;

export type AssessDebugMode = (typeof assessDebugModes)[number];

/**
 * Debug routes are deliberate video-shoot fixtures. Keeping the parser on the
 * server makes each state independently reachable without client-only state.
 */
export function parseAssessDebugMode(value: string | string[] | undefined): AssessDebugMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return (assessDebugModes as readonly string[]).includes(value) ? (value as AssessDebugMode) : undefined;
}
