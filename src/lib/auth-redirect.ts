export function getSafeAuthNext(
  value: string | string[] | null | undefined
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return "/";
  }

  const pathname = candidate.split(/[?#]/, 1)[0];
  if (pathname === "/login" || pathname === "/signup") return "/";
  return candidate;
}
