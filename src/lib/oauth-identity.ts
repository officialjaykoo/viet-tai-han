export const SYNTHETIC_OAUTH_EMAIL_DOMAIN =
  "oauth.viet-tai-han.invalid";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encodeIdentityPart(value: string): string {
  const trimmed = value.trim();
  if (/^[a-z0-9._-]+$/i.test(trimmed)) return trimmed.toLowerCase();

  const safePrefix = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const hex = Array.from(new TextEncoder().encode(trimmed), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${safePrefix || "identity"}-${hex || "unknown"}`;
}

/** Stable Better Auth compatibility address for a provider identity. */
export function createSyntheticOAuthEmail(
  providerId: string,
  accountId: string
): string {
  return `${encodeIdentityPart(providerId)}-${encodeIdentityPart(accountId)}@${SYNTHETIC_OAUTH_EMAIL_DOMAIN}`;
}

export function normalizeProviderEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function isSyntheticOAuthEmail(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase().endsWith(`@${SYNTHETIC_OAUTH_EMAIL_DOMAIN}`)
  );
}

/** Remove Better Auth's compatibility email before returning user data publicly. */
export function stripOAuthCompatibilityEmail<T extends Record<string, unknown>>(
  user: T
): Omit<T, "email"> {
  const { email: _email, ...safeUser } = user;
  return safeUser;
}

export function mapOAuthEmail(input: {
  providerId: string;
  accountId: string;
  email?: unknown;
  emailVerified?: boolean;
}): {
  email: string;
  contactEmail?: string;
  emailVerified: boolean;
} {
  const contactEmail = normalizeProviderEmail(input.email);
  return {
    email:
      contactEmail ??
      createSyntheticOAuthEmail(input.providerId, input.accountId),
    ...(contactEmail ? { contactEmail } : {}),
    emailVerified: Boolean(contactEmail && input.emailVerified),
  };
}
