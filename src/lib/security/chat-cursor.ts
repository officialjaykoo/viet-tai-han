import {
  base64UrlToBytes,
  bytesToBase64Url,
  hmacSha256,
  timingSafeEqual,
} from "@/lib/security/crypto";

export const CHAT_CURSOR_TTL_MS = 24 * 60 * 60_000;
const CHAT_CURSOR_VERSION = 1 as const;
const MAX_CURSOR_LENGTH = 2048;
const MAX_POSITION_LENGTH = 200;

export type ChatCursorDirection = "before" | "after";

export type ChatCursorPosition = {
  createdAt: string;
  id: string;
};

export type ChatCursorContext = {
  roomId: string;
  userId: string;
  direction: ChatCursorDirection;
};

type SealedChatCursor = ChatCursorPosition &
  ChatCursorContext & {
    v: typeof CHAT_CURSOR_VERSION;
    iat: number;
    exp: number;
  };

export class InvalidChatCursorError extends Error {
  constructor(message = "Invalid chat cursor") {
    super(message);
    this.name = "InvalidChatCursorError";
  }
}

function validPosition(
  position: unknown
): position is ChatCursorPosition {
  if (!position || typeof position !== "object") return false;
  const record = position as Record<string, unknown>;
  return (
    typeof record.createdAt === "string" &&
    record.createdAt.length > 0 &&
    record.createdAt.length <= MAX_POSITION_LENGTH &&
    Number.isFinite(Date.parse(record.createdAt)) &&
    typeof record.id === "string" &&
    record.id.length > 0 &&
    record.id.length <= MAX_POSITION_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(record.id)
  );
}

function validContext(
  context: unknown
): context is ChatCursorContext {
  if (!context || typeof context !== "object") return false;
  const record = context as Record<string, unknown>;
  return (
    typeof record.roomId === "string" &&
    record.roomId.length > 0 &&
    record.roomId.length <= MAX_POSITION_LENGTH &&
    typeof record.userId === "string" &&
    record.userId.length > 0 &&
    record.userId.length <= MAX_POSITION_LENGTH &&
    (record.direction === "before" || record.direction === "after")
  );
}

async function cursorSecret(): Promise<Uint8Array> {
  const { getEnv } = await import("@/lib/db");
  const env = await getEnv();
  const secret =
    env.BETTER_AUTH_SECRET || "dev-secret-must-be-at-least-32-chars!!";
  return new TextEncoder().encode(`vth-chat-cursor-v1:${secret}`);
}

function encodePayload(payload: SealedChatCursor): string {
  return bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
}

function decodePayload(raw: string): SealedChatCursor | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(raw));
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const position = {
      createdAt: record.createdAt,
      id: record.id,
    };
    const context = {
      roomId: record.roomId,
      userId: record.userId,
      direction: record.direction,
    };
    const issuedAt = record.iat;
    const expiresAt = record.exp;
    if (
      record.v !== CHAT_CURSOR_VERSION ||
      typeof issuedAt !== "number" ||
      typeof expiresAt !== "number" ||
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      !validPosition(position) ||
      !validContext(context)
    ) {
      return null;
    }
    return {
      v: CHAT_CURSOR_VERSION,
      createdAt: position.createdAt,
      id: position.id,
      roomId: context.roomId,
      userId: context.userId,
      direction: context.direction,
      iat: issuedAt,
      exp: expiresAt,
    };
  } catch {
    return null;
  }
}

export async function signChatCursorWithSecret(
  secret: Uint8Array,
  position: ChatCursorPosition,
  context: ChatCursorContext,
  ttlMs = CHAT_CURSOR_TTL_MS,
  now = Date.now()
): Promise<string> {
  if (!validPosition(position) || !validContext(context)) {
    throw new InvalidChatCursorError();
  }
  const payload: SealedChatCursor = {
    v: CHAT_CURSOR_VERSION,
    ...position,
    ...context,
    iat: now,
    exp: now + ttlMs,
  };
  const body = encodePayload(payload);
  const mac = await hmacSha256(secret, body);
  return `cc1.${body}.${bytesToBase64Url(mac)}`;
}

export async function openChatCursorWithSecret(
  secret: Uint8Array,
  token: string | null | undefined,
  expect: ChatCursorContext,
  now = Date.now()
): Promise<ChatCursorPosition | null> {
  if (!token) return null;
  if (token.length > MAX_CURSOR_LENGTH || !validContext(expect)) {
    throw new InvalidChatCursorError();
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "cc1") {
    throw new InvalidChatCursorError();
  }
  const [, body, mac] = parts;
  if (!body || !mac) throw new InvalidChatCursorError();

  const expectedMac = await hmacSha256(secret, body);
  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(mac);
  } catch {
    throw new InvalidChatCursorError();
  }
  if (!timingSafeEqual(expectedMac, provided)) {
    throw new InvalidChatCursorError();
  }

  const payload = decodePayload(body);
  if (!payload) throw new InvalidChatCursorError();
  if (payload.exp < now || payload.iat > now + 60_000) {
    throw new InvalidChatCursorError("Chat cursor expired");
  }
  if (
    payload.roomId !== expect.roomId ||
    payload.userId !== expect.userId ||
    payload.direction !== expect.direction
  ) {
    throw new InvalidChatCursorError("Chat cursor context mismatch");
  }

  return {
    createdAt: payload.createdAt,
    id: payload.id,
  };
}

export async function signChatCursor(
  position: ChatCursorPosition,
  context: ChatCursorContext,
  ttlMs = CHAT_CURSOR_TTL_MS
): Promise<string> {
  return signChatCursorWithSecret(
    await cursorSecret(),
    position,
    context,
    ttlMs
  );
}

export async function openChatCursor(
  token: string | null | undefined,
  context: ChatCursorContext
): Promise<ChatCursorPosition | null> {
  return openChatCursorWithSecret(await cursorSecret(), token, context);
}
