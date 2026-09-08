const ATK_ONLY_MUTATION_PATHS = new Set(["/api/auth/sign-out"]);

/**
 * Authentication mutations that need request signing but no product mutation
 * limiter, one-time challenge, or proof-of-work.
 */
export function isAtkOnlyMutation(method: string, path: string): boolean {
  return (
    method.toUpperCase() === "POST" && ATK_ONLY_MUTATION_PATHS.has(path)
  );
}
