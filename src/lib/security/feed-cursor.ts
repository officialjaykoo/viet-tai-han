import type { FeedMode, FeedSort } from "@/lib/db";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  hmacSha256,
  timingSafeEqual,
} from "@/lib/security/crypto";

export const FEED_CURSOR_TTL_MS = 24 * 60 * 60_000;
const CURSOR_VERSION = 1 as const;

export type FeedCursorPosition = {
  createdAt: string;
  id: string;
  score?: number;
};

export type FeedCursorContext = {
  sort: FeedSort;
  mode: FeedMode;
  subreddit: string | null;
  authorId: string | null;
  viewerId: string | null;
};

type SealedPayload = FeedCursorPosition &
  FeedCursorContext & {
    v: typeof CURSOR_VERSION;
    iat: number;
    exp: number;
  };

export class InvalidFeedCursorError extends Error {
  constructor(message = "Invalid cursor") {
    super(message);
    this.name = "InvalidFeedCursorError";
  }
}

async function cursorSecret(): Promise<Uint8Array> {
  // Dynamic import avoids a static cycle with db.ts (which signs cursors).
  const { getEnv } = await import("@/lib/db");
  const env = await getEnv();
  const secret =
    env.BETTER_AUTH_SECRET || "dev-secret-must-be-at-least-32-chars!!";
  return new TextEncoder().encode(`red-feed-cursor-v1:${secret}`);
}

function encodePayload(payload: SealedPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(raw: string): SealedPayload | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(raw));
    const parsed = JSON.parse(json) as Partial<SealedPayload>;
    if (
      parsed.v !== CURSOR_VERSION ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.sort !== "string" ||
      typeof parsed.mode !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return {
      v: CURSOR_VERSION,
      createdAt: parsed.createdAt,
      id: parsed.id,
      score: typeof parsed.score === "number" ? parsed.score : undefined,
      sort: parsed.sort as FeedSort,
      mode: parsed.mode as FeedMode,
      subreddit: parsed.subreddit ?? null,
      authorId: parsed.authorId ?? null,
      viewerId: parsed.viewerId ?? null,
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

function sameNullable(a: string | null, b: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

/** Low-level signer with an explicit key (used by tests). */
export async function signFeedCursorWithSecret(
  secret: Uint8Array,
  position: FeedCursorPosition,
  context: FeedCursorContext,
  ttlMs = FEED_CURSOR_TTL_MS,
  now = Date.now()
): Promise<string> {
  const payload: SealedPayload = {
    v: CURSOR_VERSION,
    createdAt: position.createdAt,
    id: position.id,
    ...(position.score != null ? { score: position.score } : {}),
    sort: context.sort,
    mode: context.mode,
    subreddit: context.subreddit,
    authorId: context.authorId,
    viewerId: context.viewerId,
    iat: now,
    exp: now + ttlMs,
  };
  const body = encodePayload(payload);
  const mac = await hmacSha256(secret, body);
  return `fc1.${body}.${bytesToBase64Url(mac)}`;
}

/** Low-level opener with an explicit key (used by tests). */
export async function openFeedCursorWithSecret(
  secret: Uint8Array,
  token: string | null | undefined,
  expect: FeedCursorContext,
  now = Date.now()
): Promise<FeedCursorPosition | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "fc1") {
    throw new InvalidFeedCursorError();
  }
  const [, body, mac] = parts;
  if (!body || !mac) throw new InvalidFeedCursorError();

  const expectedMac = await hmacSha256(secret, body);
  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(mac);
  } catch {
    throw new InvalidFeedCursorError();
  }
  if (!timingSafeEqual(expectedMac, provided)) {
    throw new InvalidFeedCursorError();
  }

  const payload = decodePayload(body);
  if (!payload) throw new InvalidFeedCursorError();
  if (payload.exp < now) {
    throw new InvalidFeedCursorError("Cursor expired");
  }
  if (
    payload.sort !== expect.sort ||
    payload.mode !== expect.mode ||
    !sameNullable(payload.subreddit, expect.subreddit) ||
    !sameNullable(payload.authorId, expect.authorId) ||
    !sameNullable(payload.viewerId, expect.viewerId)
  ) {
    throw new InvalidFeedCursorError("Cursor context mismatch");
  }

  return {
    createdAt: payload.createdAt,
    id: payload.id,
    ...(payload.score != null ? { score: payload.score } : {}),
  };
}

/** Issue a tamper-evident cursor bound to feed context. */
export async function signFeedCursor(
  position: FeedCursorPosition,
  context: FeedCursorContext,
  ttlMs = FEED_CURSOR_TTL_MS
): Promise<string> {
  return signFeedCursorWithSecret(
    await cursorSecret(),
    position,
    context,
    ttlMs
  );
}

/**
 * Verify signature, expiry, and feed-context binding.
 * Throws InvalidFeedCursorError on tamper / mismatch / expiry.
 */
export async function openFeedCursor(
  token: string | null | undefined,
  expect: FeedCursorContext
): Promise<FeedCursorPosition | null> {
  return openFeedCursorWithSecret(await cursorSecret(), token, expect);
}
