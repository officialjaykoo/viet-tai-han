/** Personal feed community for a user: `u_alice` → displayed as u/alice. */

export function profileCommunityName(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (clean.length < 2) {
    throw new Error("Invalid username for profile posts");
  }
  return `u_${clean}`.slice(0, 32);
}

export function parseProfileCommunityName(name: string): string | null {
  const match = /^u_([a-z0-9_]{2,31})$/i.exec(name.trim());
  return match?.[1] ?? null;
}

export function isProfileCommunityName(name: string): boolean {
  return parseProfileCommunityName(name) !== null;
}
