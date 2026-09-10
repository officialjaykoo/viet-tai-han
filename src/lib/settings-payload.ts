import { isLocale, type Locale } from "@/lib/i18n/config";

const SETTINGS_SECTIONS = ["profile", "contactEmail", "preferences"] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const PROFILE_KEYS = new Set(["section", "name", "bio", "image", "bannerKey"]);
const PREFERENCE_KEYS = new Set([
  "section",
  "theme",
  "preferredLanguage",
  "allowDms",
  "notifyComments",
  "notifyFollows",
  "notifyChat",
  "notifyMentions",
]);

export type SettingsPatch =
  | {
      section: "profile";
      name?: string;
      bio?: string | null;
      image?: string | null;
      bannerKey?: string | null;
    }
  | {
      section: "contactEmail";
      contactEmail: string;
    }
  | {
      section: "preferences";
      theme?: "system" | "light" | "dark";
      preferredLanguage?: Locale;
      allowDms?: "anyone" | "followers" | "nobody";
      notifyComments?: boolean;
      notifyFollows?: boolean;
      notifyChat?: boolean;
      notifyMentions?: boolean;
    };

export type SettingsPayloadResult =
  | { ok: true; value: SettingsPatch }
  | { ok: false; error: "Invalid settings payload" | "Unknown section" | "Invalid theme" | "Invalid language" | "Invalid DM preference" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasPatch(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => key !== "section");
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const BOOLEAN_FIELDS = [
  "notifyComments",
  "notifyFollows",
  "notifyChat",
  "notifyMentions",
] as const;

export function parseSettingsPatch(input: unknown): SettingsPayloadResult {
  if (!isRecord(input) || typeof input.section !== "string") {
    return { ok: false, error: "Invalid settings payload" };
  }
  if (!SETTINGS_SECTIONS.includes(input.section as SettingsSection)) {
    return { ok: false, error: "Unknown section" };
  }
  if (!hasPatch(input)) return { ok: false, error: "Invalid settings payload" };

  if (input.section === "profile") {
    if (!hasOnlyKeys(input, PROFILE_KEYS)) {
      return { ok: false, error: "Invalid settings payload" };
    }
    if (input.name !== undefined && typeof input.name !== "string") {
      return { ok: false, error: "Invalid settings payload" };
    }
    if (input.bio !== undefined && !isStringOrNull(input.bio)) {
      return { ok: false, error: "Invalid settings payload" };
    }
    if (input.image !== undefined && !isStringOrNull(input.image)) {
      return { ok: false, error: "Invalid settings payload" };
    }
    if (input.bannerKey !== undefined && !isStringOrNull(input.bannerKey)) {
      return { ok: false, error: "Invalid settings payload" };
    }
    return { ok: true, value: input as SettingsPatch };
  }

  if (input.section === "contactEmail") {
    if (
      !hasOnlyKeys(input, new Set(["section", "contactEmail"])) ||
      typeof input.contactEmail !== "string"
    ) {
      return { ok: false, error: "Invalid settings payload" };
    }
    return { ok: true, value: input as SettingsPatch };
  }

  if (!hasOnlyKeys(input, PREFERENCE_KEYS)) {
    return { ok: false, error: "Invalid settings payload" };
  }
  if (
    input.theme !== undefined &&
    input.theme !== "system" &&
    input.theme !== "light" &&
    input.theme !== "dark"
  ) {
    return { ok: false, error: "Invalid theme" };
  }
  if (
    input.preferredLanguage !== undefined &&
    (!isLocale(input.preferredLanguage) || typeof input.preferredLanguage !== "string")
  ) {
    return { ok: false, error: "Invalid language" };
  }
  if (
    input.allowDms !== undefined &&
    input.allowDms !== "anyone" &&
    input.allowDms !== "followers" &&
    input.allowDms !== "nobody"
  ) {
    return { ok: false, error: "Invalid DM preference" };
  }
  for (const field of BOOLEAN_FIELDS) {
    if (input[field] !== undefined && typeof input[field] !== "boolean") {
      return { ok: false, error: "Invalid settings payload" };
    }
  }
  return { ok: true, value: input as SettingsPatch };
}

export type ProfilePatch = {
  username?: string;
  name?: string;
  bio?: string | null;
  image?: string | null;
  bannerKey?: string | null;
};

export function parseProfilePatch(
  input: unknown
): { ok: true; value: ProfilePatch } | { ok: false } {
  if (!isRecord(input)) return { ok: false };
  const allowed = new Set([
    "username",
    "name",
    "bio",
    "image",
    "bannerKey",
  ]);
  if (!hasOnlyKeys(input, allowed)) return { ok: false };
  if (!Object.keys(input).length) return { ok: false };
  if (input.username !== undefined && typeof input.username !== "string") {
    return { ok: false };
  }
  if (input.name !== undefined && typeof input.name !== "string") {
    return { ok: false };
  }
  if (input.bio !== undefined && !isStringOrNull(input.bio)) {
    return { ok: false };
  }
  if (input.image !== undefined && !isStringOrNull(input.image)) {
    return { ok: false };
  }
  if (input.bannerKey !== undefined && !isStringOrNull(input.bannerKey)) {
    return { ok: false };
  }
  return { ok: true, value: input as ProfilePatch };
}
