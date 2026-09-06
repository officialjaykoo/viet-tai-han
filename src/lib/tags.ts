import { accountAgeDays } from "@/lib/account-age";

export type AccountTagId = "admin" | "moderator" | "veteran" | "nsfw";

export type AccountTag = {
  id: AccountTagId;
  label: string;
};

export const VETERAN_DAYS = 365;
export const VETERAN_KARMA = 1000;

export { accountAgeDays } from "@/lib/account-age";

/**
 * Visible account tags only; reputation badges never grant access or bypass
 * authentication, privacy, moderation, or abuse controls.
 */
export function resolveAccountTags(input: {
  role?: string | null;
  isNsfw?: boolean | number | null;
  createdAt?: string | null;
  karma?: number | null;
  isCommunityMod?: boolean | null;
  hasVeteranAchievement?: boolean | null;
}): AccountTag[] {
  const role = input.role ?? "user";
  const tags: AccountTag[] = [];

  if (role === "admin") {
    tags.push({ id: "admin", label: "Admin" });
  }

  if (role === "moderator" || input.isCommunityMod) {
    tags.push({ id: "moderator", label: "Mod" });
  }

  if (
    input.hasVeteranAchievement ||
    accountAgeDays(input.createdAt) >= VETERAN_DAYS ||
    (input.karma ?? 0) >= VETERAN_KARMA
  ) {
    tags.push({ id: "veteran", label: "Veteran" });
  }

  if (input.isNsfw === true || input.isNsfw === 1) {
    tags.push({ id: "nsfw", label: "NSFW" });
  }

  return tags;
}
