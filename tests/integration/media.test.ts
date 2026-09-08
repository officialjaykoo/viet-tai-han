import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  assertOwnedMediaKey,
  cleanupUnreferencedMedia,
} from "@/lib/media";

async function insertMediaUser(userId: string, username: string) {
  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, role, status)
     VALUES (?, 'Media User', ?, 1, ?, 'user', 'active')`
  )
    .bind(userId, `${userId}@media.test`, username)
    .run();
}

describe("media ownership registry", () => {
  it("allows only the uploader and removes old unreferenced objects", async () => {
    const ownerId = `media_owner_${crypto.randomUUID()}`;
    const foreignId = `media_foreign_${crypto.randomUUID()}`;
    const ownerUsername = `media_owner_${crypto.randomUUID().slice(0, 6)}`;
    const foreignUsername = `media_foreign_${crypto.randomUUID().slice(0, 6)}`;
    const unreferencedKey = `media/cleanup_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.jpg`;
    const referencedKey = `media/keep_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.jpg`;
    await insertMediaUser(ownerId, ownerUsername);
    await insertMediaUser(foreignId, foreignUsername);
    await env.MEDIA_BUCKET.put(unreferencedKey, new Uint8Array([1]), {
      customMetadata: { uploadedBy: ownerId },
    });
    await env.MEDIA_BUCKET.put(referencedKey, new Uint8Array([1]), {
      customMetadata: { uploadedBy: ownerId },
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO media_objects (media_key, uploaded_by, created_at)
         VALUES (?, ?, '2000-01-01 00:00:00')`
      ).bind(unreferencedKey, ownerId),
      env.DB.prepare(
        `INSERT INTO media_objects (media_key, uploaded_by, created_at)
         VALUES (?, ?, '2000-01-01 00:00:00')`
      ).bind(referencedKey, ownerId),
      env.DB.prepare(`UPDATE "user" SET image = ? WHERE id = ?`).bind(
        `/api/media/${referencedKey}`,
        ownerId
      ),
    ]);

    await expect(assertOwnedMediaKey(unreferencedKey, ownerId)).resolves.toBeUndefined();
    await expect(assertOwnedMediaKey(unreferencedKey, foreignId)).rejects.toMatchObject({
      status: 400,
    });

    const deleted = await cleanupUnreferencedMedia({
      olderThanDays: 1,
      limit: 500,
    });
    expect(deleted).toBeGreaterThanOrEqual(1);
    await expect(env.MEDIA_BUCKET.head(unreferencedKey)).resolves.toBeNull();
    await expect(env.MEDIA_BUCKET.head(referencedKey)).resolves.not.toBeNull();
    const registry = await env.DB.prepare(
      `SELECT media_key FROM media_objects WHERE media_key IN (?, ?)`
    )
      .bind(unreferencedKey, referencedKey)
      .all<{ media_key: string }>();
    expect(registry.results?.map((row) => row.media_key)).toEqual([referencedKey]);
  });
});
