export type ProfileLinkUser = {
  id?: string | null;
  username?: string | null;
};

/** Format a public handle for display; profile routes remain separate. */
export function formatUserHandle(
  username: string | null | undefined,
  fallback = "Someone"
): string {
  const value = username?.trim();
  return value ? `@${value}` : fallback;
}

export function getUsernameProfileHref(
  username: string | null | undefined
): string | null {
  const value = username?.trim();
  return value ? `/u/${encodeURIComponent(value)}` : null;
}

/** Build a public profile link without exposing the internal user id. */
export function getProfileHref(
  user: ProfileLinkUser | null | undefined,
  signedOutHref = "/login"
): string {
  const usernameHref = getUsernameProfileHref(user?.username);
  if (usernameHref) return usernameHref;
  if (user?.id) return "/onboarding";
  return signedOutHref;
}
