import { getDb } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/security/crypto";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** Create a personal API key. Returns the raw secret once. */
export async function createApiKey(input: {
  userId: string;
  name?: string;
}): Promise<{ key: string; record: ApiKeyRow }> {
  const db = await getDb();
  const id = `ak_${randomToken(12)}`;
  const secret = `red_${randomToken(24)}`;
  const keyHash = await sha256Hex(secret);
  const keyPrefix = secret.slice(0, 10);
  const name = (input.name?.trim() || "default").slice(0, 64);

  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, input.userId, name, keyHash, keyPrefix)
    .run();

  return {
    key: secret,
    record: {
      id,
      name,
      keyPrefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    },
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, name,
              key_prefix AS keyPrefix,
              created_at AS createdAt,
              last_used_at AS lastUsedAt,
              revoked_at AS revokedAt
       FROM api_keys
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<ApiKeyRow>();
  return results ?? [];
}

export async function revokeApiKey(input: {
  userId: string;
  keyId: string;
}): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .prepare(
      `UPDATE api_keys
       SET revoked_at = datetime('now')
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
    )
    .bind(input.keyId, input.userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
