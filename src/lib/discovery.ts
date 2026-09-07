export type DiscoverySource =
  | "home"
  | "popular"
  | "community"
  | "profile"
  | "search"
  | "direct"
  | "shared"
  | "unknown";

export function parseDiscoverySource(
  value: string | null | undefined
): DiscoverySource {
  if (
    value === "home" ||
    value === "popular" ||
    value === "community" ||
    value === "profile" ||
    value === "search" ||
    value === "direct" ||
    value === "shared" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}
