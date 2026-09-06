export const TEMPORARY_USERNAME_PREFIX = "vth_user_";
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 90;
export const USERNAME_REUSE_HOLD_DAYS = 180;
export const DEFAULT_DISPLAY_NAME = "VTH User";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const COMBINING_MARKS = /\p{M}/gu;
const NON_USERNAME_CHARS = /[^a-zA-Z0-9_]+/g;

export type UsernameValidation =
  | { ok: true; username: string }
  | { ok: false; reason: "required" | "invalid" };

export type UsernameAvailability = "available" | "taken" | "reserved";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(value: unknown): UsernameValidation {
  if (typeof value !== "string") return { ok: false, reason: "required" };

  const username = normalizeUsername(value);
  if (!username) return { ok: false, reason: "required" };
  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH ||
    !USERNAME_PATTERN.test(username)
  ) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, username };
}

export function isTemporaryUsername(value: unknown): boolean {
  return (
    typeof value === "string" && value.startsWith(TEMPORARY_USERNAME_PREFIX)
  );
}

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_DISPLAY_NAME;
  return value.trim().slice(0, 80) || DEFAULT_DISPLAY_NAME;
}

function transliterate(value: string): string {
  return value
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "");
}

function slugifyUsernameCandidate(value: string): string | null {
  const candidate = transliterate(value)
    .replace(NON_USERNAME_CHARS, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .toLowerCase();

  return validateUsername(candidate).ok ? candidate : null;
}

export function createRandomUsernameCandidate(): string {
  return `vth_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function createUsernameCandidate(input: {
  providerUsername?: unknown;
  displayName?: unknown;
}): string {
  const providerCandidate =
    typeof input.providerUsername === "string"
      ? slugifyUsernameCandidate(input.providerUsername)
      : null;
  if (providerCandidate) return providerCandidate;

  const displayName = normalizeDisplayName(input.displayName);
  if (displayName !== DEFAULT_DISPLAY_NAME) {
    const displayCandidate = slugifyUsernameCandidate(displayName);
    if (displayCandidate) return displayCandidate;
  }

  return createRandomUsernameCandidate();
}

export function toSqliteDate(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export function parseSqliteDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function usernameCooldownEndsAt(
  usernameChangedAt: string | null | undefined
): Date | null {
  const changedAt = parseSqliteDate(usernameChangedAt);
  if (!changedAt) return null;
  return new Date(
    changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
}

export function isUsernameChangeAllowed(
  usernameChangedAt: string | null | undefined,
  now = new Date()
): boolean {
  const cooldownEndsAt = usernameCooldownEndsAt(usernameChangedAt);
  return !cooldownEndsAt || cooldownEndsAt.getTime() <= now.getTime();
}

export function usernameReservedUntil(changedAt = new Date()): string {
  return toSqliteDate(
    new Date(
      changedAt.getTime() + USERNAME_REUSE_HOLD_DAYS * 24 * 60 * 60 * 1000
    )
  );
}

export async function getUsernameAvailability(
  db: D1Database,
  value: string,
  options: { excludeUserId?: string | null; now?: Date } = {}
): Promise<UsernameAvailability> {
  const validation = validateUsername(value);
  if (!validation.ok) return "taken";

  const excludeUserId = options.excludeUserId ?? "";
  const current = await db
    .prepare(
      `SELECT 1 AS found
       FROM "user"
       WHERE username = ? COLLATE NOCASE AND id <> ?
       LIMIT 1`
    )
    .bind(validation.username, excludeUserId)
    .first<{ found: number }>();
  if (current) return "taken";

  const now = toSqliteDate(options.now ?? new Date());
  const reserved = await db
    .prepare(
      `SELECT 1 AS found
       FROM username_history
       WHERE username = ? COLLATE NOCASE AND reservedUntil > ?
       LIMIT 1`
    )
    .bind(validation.username, now)
    .first<{ found: number }>();
  return reserved ? "reserved" : "available";
}

export async function createTemporaryUsername(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${TEMPORARY_USERNAME_PREFIX}${crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)}`;
    const existing = await db
      .prepare(`SELECT 1 AS found FROM "user" WHERE username = ? COLLATE NOCASE`)
      .bind(candidate)
      .first<{ found: number }>();
    if (!existing) return candidate;
  }

  throw new Error("Could not allocate a temporary username");
}
