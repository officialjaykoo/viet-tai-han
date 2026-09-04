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
  body: string;
  createdAt: string;
  senderId: string;
  senderUsername: string | null;
};

type ChatRoomEvent = {
  type: "ready" | "message";
  roomId: string;
  message?: {
    id: string;
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
    // Cloudflare handles protocol-level ping/pong without waking the object.
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return this.#connect(request, url.searchParams.get("room"));
    }

    if (request.method === "POST" && url.pathname === "/broadcast") {
      return this.#broadcast(request, url.searchParams.get("room"));
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

    const eventFor = (socket: WebSocket): ChatRoomEvent => {
      const userId = userIdForSocket(this.ctx, socket);
      return {
        type: "message",
        roomId: input.roomId,
        message: {
          id: input.id,
          body: input.body,
          createdAt: input.createdAt,
          isMine: userId === input.senderId,
          senderUsername: input.senderUsername,
        },
      };
    };

    let delivered = 0;
    for (const socket of this.ctx.getWebSockets(`room:${input.roomId}`)) {
      try {
        socket.send(JSON.stringify(eventFor(socket)));
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
    const { results } = await this.env.DB.prepare(
      `SELECT user_id, membership_status
       FROM chat_room_members
       WHERE room_id = ?`
    )
      .bind(roomId)
      .all<{ user_id: string; membership_status: string }>();

    const members = results ?? [];
    const self = members.find((member) => member.user_id === userId);
    const peer = members.find((member) => member.user_id !== userId);
    if (
      !self ||
      self.membership_status !== "active" ||
      !peer ||
      peer.membership_status !== "active"
    ) {
      return false;
    }

    const blocked = await this.env.DB.prepare(
      `SELECT 1 AS ok
       FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)`
    )
      .bind(userId, peer.user_id, peer.user_id, userId)
      .first();

    return !blocked;
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
