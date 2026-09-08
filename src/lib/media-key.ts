/**
 * Shared media-key helpers (server + client safe).
 * Keep this module free of "use client" so Server Components can call it.
 */

const MEDIA_KEY_PATTERN = /^media\/[A-Za-z0-9_-]{8,32}\.(jpg|webp)$/;

export function isValidMediaKey(value: unknown): value is string {
  return typeof value === "string" && MEDIA_KEY_PATTERN.test(value);
}

/** Resolve a stored image field to a validated media key for TunneledMedia. */
export function mediaKeyFromImageField(
  image: string | null | undefined
): string | null {
  const value = typeof image === "string" ? image.trim() : "";
  if (!value) return null;

  for (const prefix of ["/api/media/", "/i/media/"] as const) {
    if (!value.startsWith(prefix)) continue;
    const key = value.slice(prefix.length);
    return isValidMediaKey(key) ? key : null;
  }

  return isValidMediaKey(value) ? value : null;
}
