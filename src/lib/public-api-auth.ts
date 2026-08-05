import { NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/security/challenge";
import { AuthError } from "@/lib/session";
import { sha256Hex } from "@/lib/security/crypto";

/**
 * Public `/api/*` access requires a personal API key:
 *   Authorization: Bearer <key>
 *
 * Keys are stored hashed in `api_keys`.
 */
export async function requirePublicApiKey(
  request: NextRequest | Request
): Promise<{ ip: string; userId: string; keyId: string }> {
  const ip = clientIpFromHeaders(request.headers);
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AuthError("API key required", 401);
  }
  const raw = match[1].trim();
  if (raw.length < 16) {
    throw new AuthError("Invalid API key", 401);
  }

  const hash = await sha256Hex(raw);
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id, user_id AS userId, revoked_at AS revokedAt
       FROM api_keys
       WHERE key_hash = ?
       LIMIT 1`
    )
    .bind(hash)
    .first<{ id: string; userId: string; revokedAt: string | null }>();

  if (!row || row.revokedAt) {
    throw new AuthError("Invalid API key", 401);
  }

  void db
    .prepare(
      `UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`
    )
    .bind(row.id)
    .run();

  return { ip, userId: row.userId, keyId: row.id };
}
