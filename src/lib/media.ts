import { getEnv } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import {
  MAX_UPLOAD_BYTES,
  processUploadedImage,
} from "@/lib/image-process";
import { AuthError } from "@/lib/session";

export function isAllowedMediaKey(key: string): boolean {
  return /^media\/[A-Za-z0-9_-]{8,32}\.(jpg|webp)$/.test(key);
}

export async function assertOwnedMediaKey(
  key: string,
  userId: string
): Promise<void> {
  if (!isAllowedMediaKey(key)) {
    throw new AuthError("Invalid media", 400);
  }

  const env = await getEnv();
  const object = await env.MEDIA_BUCKET.head(key);
  if (!object || object.customMetadata?.uploadedBy !== userId) {
    throw new AuthError("Invalid media", 400);
  }
}

/**
 * Media objects are immutable and retained after upload, including when a
 * request times out or the owning post is soft-deleted. A retry can still
 * reference a post whose response was lost, so request-time deletion would
 * risk deleting canonical media. Cleanup must be an authenticated,
 * age-based janitor once an ownership registry is available.
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
