export type ProfileLinkUser = {
  id?: string | null;
  username?: string | null;
};

/** Build a profile link that still works before a social user picks a username. */
export function getProfileHref(
  user: ProfileLinkUser | null | undefined,
  signedOutHref = "/login"
): string {
  const username = user?.username?.trim();
  if (username) return `/u/${encodeURIComponent(username)}`;
  if (user?.id) return `/u/${encodeURIComponent(user.id)}`;
  return signedOutHref;
}
