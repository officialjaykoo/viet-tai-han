/**
 * Shared media-key helpers (server + client safe).
 * Keep this module free of "use client" so Server Components can call it.
 */

/** Resolve a stored image field to a media key for TunneledMedia, or null. */
export function mediaKeyFromImageField(
  image: string | null | undefined
): string | null {
  if (!image) return null;
  if (image.startsWith("/api/media/")) return image.slice("/api/media/".length);
  if (image.startsWith("/i/media/")) return image.slice("/i/media/".length);
  if (image.startsWith("media/")) return image;
  return null;
}
