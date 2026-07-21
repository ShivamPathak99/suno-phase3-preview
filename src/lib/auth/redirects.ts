/** Rejects external/ambiguous return paths before using a login `next` value. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  return value;
}
