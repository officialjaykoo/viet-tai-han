export type ProfileLinkUser = {
  id?: string | null;
  username?: string | null;
};

/** Build a public profile link without exposing the internal user id. */
export function getProfileHref(
  user: ProfileLinkUser | null | undefined,
  signedOutHref = "/login"
): string {
  const username = user?.username?.trim();
  if (username) return `/u/${encodeURIComponent(username)}`;
  if (user?.id) return "/onboarding";
  return signedOutHref;
}
