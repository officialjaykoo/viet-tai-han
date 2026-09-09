import { DurableObject } from "cloudflare:workers";

const USER_ID_HEADER = "x-vth-user-id";
const INTERNAL_TOKEN_HEADER = "x-vth-realtime-token";

export interface ChatRoomEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
}

type ChatMessageBroadcast = {
  roomId: string;
  id: string;
  clientMessageId?: string | null;
  body: string;
  createdAt: string;
  senderId: string;
  senderUsername: string | null;
};

type ChatRoomEvent = {
  type: "ready" | "message" | "revoked";
  roomId: string;
  reason?: "membership_revoked" | "account_banned";
  message?: {
    id: string;
    clientMessageId: string | null;
    body: string;
    createdAt: string;
    isMine: boolean;
    senderUsername: string | null;
  };
};
function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function userIdForSocket(ctx: DurableObjectState, socket: WebSocket): string | null {
  const tag = ctx
    .getTags(socket)
    .find((value) => value.startsWith("user:"));
  return tag ? tag.slice("user:".length) : null;
}

function isChatMessageBroadcast(value: unknown): value is ChatMessageBroadcast {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ChatMessageBroadcast>;
  return (
    typeof input.roomId === "string" &&
    input.roomId.length > 0 &&
    typeof input.id === "string" &&
    input.id.length > 0 &&
    typeof input.body === "string" &&
    input.body.length > 0 &&
    input.body.length <= 4000 &&
    typeof input.createdAt === "string" &&
    typeof input.senderId === "string" &&
    input.senderId.length > 0 &&
    (input.clientMessageId === undefined ||
      input.clientMessageId === null ||
      (typeof input.clientMessageId === "string" &&
        input.clientMessageId.length > 0 &&
        input.clientMessageId.length <= 200)) &&
    (typeof input.senderUsername === "string" || input.senderUsername === null)
  );
}
/**
 * One hibernatable Durable Object instance per active DM room.
 * D1 remains the source of truth; this object only coordinates live delivery.
 */
export class ChatRoom extends DurableObject<ChatRoomEnv> {
  constructor(ctx: DurableObjectState, env: ChatRoomEnv) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      return this.#connect(request, url.searchParams.get("room"));
    }

    if (request.method === "POST" && url.pathname === "/broadcast") {
      return this.#broadcast(request, url.searchParams.get("room"));
    }

    if (request.method === "POST" && url.pathname === "/revoke") {
      return this.#revoke(request, url.searchParams.get("room"));
    }

    return json({ error: "Not found" }, 404);
  }

  async #connect(request: Request, roomIdParam: string | null): Promise<Response> {
    if (request.headers.get(INTERNAL_TOKEN_HEADER) !== this.env.BETTER_AUTH_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const roomId = roomIdParam?.trim();
    const userId = request.headers.get(USER_ID_HEADER)?.trim();
    if (!roomId || !userId) {
      return json({ error: "Room and user are required" }, 400);
    }

    if (!(await this.#canConnect(roomId, userId))) {
      return json({ error: "Chat not found" }, 404);
    }

    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [`room:${roomId}`, `user:${userId}`]);
    server.send(
      JSON.stringify({
        type: "ready",
        roomId,
      } satisfies ChatRoomEvent)
    );

    return new Response(null, {
      status: 101,
      webSocket: pair[0],
    });
  }

  async #broadcast(
    request: Request,
    roomIdParam: string | null
  ): Promise<Response> {
    if (request.headers.get(INTERNAL_TOKEN_HEADER) !== this.env.BETTER_AUTH_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return json({ error: "Invalid message" }, 400);
    }

    if (!isChatMessageBroadcast(input) || input.roomId !== roomIdParam) {
      return json({ error: "Invalid message" }, 400);
    }

    let authorizedUserIds: Set<string>;
    try {
      authorizedUserIds = await this.#authorizedUserIds(input.roomId);
    } catch {
      // Fail closed: a D1 authorization failure must not leak a payload.
      return json({ error: "Realtime authorization unavailable" }, 503);
    }

    const eventFor = (userId: string): ChatRoomEvent => ({
      type: "message",
      roomId: input.roomId,
      message: {
        id: input.id,
        clientMessageId: input.clientMessageId ?? null,
        body: input.body,
        createdAt: input.createdAt,
        isMine: userId === input.senderId,
        senderUsername: input.senderUsername,
      },
    });

    let delivered = 0;
    for (const socket of this.ctx.getWebSockets(`room:${input.roomId}`)) {
      const userId = userIdForSocket(this.ctx, socket);
      if (!userId || !authorizedUserIds.has(userId)) {
        this.#sendRevoked(socket, input.roomId, "membership_revoked");
        continue;
      }
      try {
        socket.send(JSON.stringify(eventFor(userId)));
        delivered += 1;
      } catch {
        try {
          socket.close(1011, "Live delivery failed");
        } catch {
          // The runtime may have already closed this socket.
        }
      }
    }

    return json({ delivered });
  }

  async #canConnect(roomId: string, userId: string): Promise<boolean> {
    const authorizedUserIds = await this.#authorizedUserIds(roomId);
    return authorizedUserIds.has(userId);
  }

  async #authorizedUserIds(roomId: string): Promise<Set<string>> {
    const { results } = await this.env.DB.prepare(
      `WITH active_members AS (
         SELECT member.user_id
         FROM chat_room_members member
         INNER JOIN "user" account ON account.id = member.user_id
         WHERE member.room_id = ?
           AND member.membership_status = 'active'
           AND account.status != 'banned'
       )
       SELECT user_id
       FROM active_members
       WHERE (SELECT COUNT(*) FROM active_members) = 2
         AND NOT EXISTS (
           SELECT 1
           FROM user_blocks block
           WHERE block.blocker_id IN (SELECT user_id FROM active_members)
             AND block.blocked_id IN (SELECT user_id FROM active_members)
         )`
    )
      .bind(roomId)
      .all<{ user_id: string }>();
    return new Set((results ?? []).map((row) => row.user_id));
  }

  async #revoke(
    request: Request,
    roomIdParam: string | null
  ): Promise<Response> {
    if (request.headers.get(INTERNAL_TOKEN_HEADER) !== this.env.BETTER_AUTH_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    const roomId = roomIdParam?.trim();
    if (!roomId) return json({ error: "Room is required" }, 400);
    const reason =
      new URL(request.url).searchParams.get("reason") === "account_banned"
        ? "account_banned"
        : "membership_revoked";
    const revoked = this.#revokeSockets(roomId, reason);
    return json({ revoked });
  }

  #sendRevoked(
    socket: WebSocket,
    roomId: string,
    reason: "membership_revoked" | "account_banned"
  ): void {
    try {
      socket.send(
        JSON.stringify({
          type: "revoked",
          roomId,
          reason,
        } satisfies ChatRoomEvent)
      );
    } catch {
      // The runtime may have already closed this socket.
    }
    try {
      socket.close(4003, reason);
    } catch {
      // The runtime may have already completed the close handshake.
    }
  }

  #revokeSockets(
    roomId: string,
    reason: "membership_revoked" | "account_banned"
  ): number {
    let revoked = 0;
    for (const socket of this.ctx.getWebSockets(`room:${roomId}`)) {
      revoked += 1;
      try {
        socket.send(
          JSON.stringify({
            type: "revoked",
            roomId,
            reason,
          } satisfies ChatRoomEvent)
        );
      } catch {
        // The runtime may have already closed this socket.
      }
      try {
        socket.close(4003, reason);
      } catch {
        // The runtime may have already completed the close handshake.
      }
    }
    return revoked;
  }

  webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean
  ): void {
    void _wasClean;
    try {
      socket.close(code, reason);
    } catch {
      // The runtime may have already completed the close handshake.
    }
  }

  webSocketError(socket: WebSocket): void {
    try {
      socket.close(1011, "Live connection failed");
    } catch {
      // The runtime may have already closed this socket.
    }
  }
}
