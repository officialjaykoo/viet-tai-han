import { getDb, getEnv } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import {
  MAX_UPLOAD_BYTES,
  processUploadedImage,
} from "@/lib/image-process";
import { normalizeAvatarImage } from "@/lib/avatar";
import {
  isValidMediaKey,
  mediaKeyFromImageField,
} from "@/lib/media-key";
import { AuthError } from "@/lib/session";

export const isAllowedMediaKey = isValidMediaKey;

export async function normalizeOwnedAvatarImage(
  image: string | null,
  userId: string
): Promise<string | null> {
  if (image === null || image.trim() === "") return null;

  const normalized = normalizeAvatarImage(image);
  if (!normalized) throw new AuthError("Invalid profile image", 400);

  const mediaKey = mediaKeyFromImageField(normalized);
  if (mediaKey) await assertOwnedMediaKey(mediaKey, userId);
  return normalized;
}


export async function assertOwnedMediaKey(
  key: string,
  userId: string
): Promise<void> {
  if (!isValidMediaKey(key)) {
    throw new AuthError("Invalid media", 400);
  }

  const env = await getEnv();
  const object = await env.MEDIA_BUCKET.head(key);
  if (!object || object.customMetadata?.uploadedBy !== userId) {
    throw new AuthError("Invalid media", 400);
  }
}

/**
 * Media objects are immutable. The registry lets a scheduled janitor remove
 * only old, unreferenced uploads; request-time deletion is intentionally
 * avoided because a retried post/profile write may still reference the object.
 */
export async function uploadPostImage(options: {
  userId: string;
  file: File;
}): Promise<{ mediaKey: string; contentType: string }> {
  if (options.file.size <= 0 || options.file.size > MAX_UPLOAD_BYTES) {
    throw new AuthError("Image must be under 1 MB", 400);
  }

  const env = await getEnv();
  const input = new Uint8Array(await options.file.arrayBuffer());

  let processed;
  try {
    processed = processUploadedImage(input);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid image";
    throw new AuthError(message, 400);
  }

  const mediaKey = `media/${createPublicId()}.${processed.extension}`;
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO media_objects (media_key, uploaded_by)
       VALUES (?, ?)`
    )
    .bind(mediaKey, options.userId)
    .run();

  await env.MEDIA_BUCKET.put(mediaKey, processed.bytes, {
    httpMetadata: {
      contentType: processed.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      // Internal only — never returned to clients
      uploadedBy: options.userId,
    },
  });

  return { mediaKey, contentType: processed.contentType };
}

export async function getMediaObject(key: string) {
  if (!isAllowedMediaKey(key)) {
    return null;
  }
  const env = await getEnv();
  return env.MEDIA_BUCKET.get(key);
}

export async function cleanupUnreferencedMedia(
  options: {
    olderThanDays?: number;
    limit?: number;
  } = {},
  runtime?: Pick<CloudflareEnv, "DB" | "MEDIA_BUCKET">
): Promise<number> {
  const olderThanDays = Math.max(
    1,
    Math.floor(options.olderThanDays ?? 7)
  );
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 100), 1), 500);
  const env = runtime ?? (await getEnv());
  const db = env.DB;
  const { results } = await db
    .prepare(
      `SELECT m.media_key
       FROM media_objects m
       WHERE m.created_at < datetime('now', '-' || ? || ' days')
         AND NOT EXISTS (
           SELECT 1 FROM posts p WHERE p.media_key = m.media_key
         )
         AND NOT EXISTS (
           SELECT 1 FROM ad_campaigns c WHERE c.image_key = m.media_key
         )
         AND NOT EXISTS (
           SELECT 1 FROM "user" u
           WHERE u.image = '/api/media/' || m.media_key
              OR u.image = '/i/media/' || m.media_key
              OR u.image = m.media_key
              OR u.bannerKey = m.media_key
         )
       LIMIT ?`
    )
    .bind(String(olderThanDays), limit)
    .all<{ media_key: string }>();

  if (!results?.length) return 0;

  let deleted = 0;
  for (const row of results) {
    if (!isValidMediaKey(row.media_key)) continue;
    await env.MEDIA_BUCKET.delete(row.media_key);
    await db
      .prepare(`DELETE FROM media_objects WHERE media_key = ?`)
      .bind(row.media_key)
      .run();
    deleted += 1;
  }
  return deleted;
}
