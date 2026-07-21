/** F1-E2: only an expired/absent authenticated session opens the re-auth flow. */
export function requiresSessionRecovery(status: number) {
  return status === 401;
}
