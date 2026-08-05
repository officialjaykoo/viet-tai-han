import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import {
  enforceCreateRateLimit,
} from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

async function resolveUserByUsername(username: string) {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id, username, name, image, status, karma
       FROM "user"
       WHERE username = ? COLLATE NOCASE AND status != 'banned'`
    )
    .bind(username.trim())
    .first<{
      id: string;
      username: string | null;
      name: string;
      image: string | null;
      status: string;
      karma: number;
    }>();
}

async function assertNotBlocked(a: string, b: string) {
  const db = await getDb();
  const blocked = await db
    .prepare(
      `SELECT 1 AS ok FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)`
    )
    .bind(a, b, b, a)
    .first();
  if (blocked) {
    throw new AuthError("You can't message this user", 403);
  }
}

export async function startChatRequest(input: {
  fromUserId: string;
  toUsername: string;
  openerBody: string;
  fromStatus?: string | null;
}) {
  const body = input.openerBody.trim();
  if (body.length < 1 || body.length > 2000) {
    throw new AuthError("Message must be 1–2000 characters", 400);
  }

  const toUser = await resolveUserByUsername(input.toUsername);
  if (!toUser) {
    throw new AuthError("User not found", 404);
  }
  if (toUser.id === input.fromUserId) {
    throw new AuthError("You can't message yourself", 400);
  }

  await assertNotBlocked(input.fromUserId, toUser.id);

  const { canReceiveChatRequest } = await import("@/lib/user-settings");
  const allowed = await canReceiveChatRequest({
    fromUserId: input.fromUserId,
    toUserId: toUser.id,
  });
  if (!allowed) {
    throw new AuthError("This user isn't accepting chat requests", 403);
  }

  await enforceCreateRateLimit(input.fromUserId, "dm_request");

  const moderation = await moderateText(body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const db = await getDb();
  const key = pairKey(input.fromUserId, toUser.id);

  const existingRoom = await db
    .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
    .bind(key)
    .first<{ id: string }>();

  if (existingRoom) {
    const membership = await db
      .prepare(
        `SELECT membership_status FROM chat_room_members
         WHERE room_id = ? AND user_id = ?`
      )
      .bind(existingRoom.id, input.fromUserId)
      .first<{ membership_status: string }>();

    if (membership?.membership_status === "active") {
      const other = await db
        .prepare(
          `SELECT membership_status FROM chat_room_members
           WHERE room_id = ? AND user_id = ?`
        )
        .bind(existingRoom.id, toUser.id)
        .first<{ membership_status: string }>();
      if (other?.membership_status === "active") {
        throw new AuthError("Chat already exists", 409);
      }
    }

    const pending = await db
      .prepare(
        `SELECT id FROM chat_requests
         WHERE room_id = ? AND status = 'pending'`
      )
      .bind(existingRoom.id)
      .first();
    if (pending) {
      throw new AuthError("A chat request is already pending", 409);
    }
  }

  const roomId = existingRoom?.id ?? createPublicId();
  const requestId = createPublicId();
  const messageId = createPublicId();
  const shadow =
    moderation.shadow || input.fromStatus === "shadowbanned" ? 1 : 0;

  if (!existingRoom) {
    await db
      .prepare(
        `INSERT INTO chat_rooms (id, kind, pair_key, created_by, last_message_at)
         VALUES (?, 'dm', ?, ?, datetime('now'))`
      )
      .bind(roomId, key, input.fromUserId)
      .run();

    await db
      .prepare(
        `INSERT INTO chat_room_members (room_id, user_id, role, membership_status, joined_at)
         VALUES (?, ?, 'owner', 'active', datetime('now'))`
      )
      .bind(roomId, input.fromUserId)
      .run();

    await db
      .prepare(
        `INSERT INTO chat_room_members (room_id, user_id, role, membership_status)
         VALUES (?, ?, 'member', 'pending')`
      )
      .bind(roomId, toUser.id)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'pending', joined_at = NULL
         WHERE room_id = ? AND user_id = ?`
      )
      .bind(roomId, toUser.id)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO chat_requests (id, room_id, from_user_id, to_user_id, opener_body, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
    .bind(requestId, roomId, input.fromUserId, toUser.id, body)
    .run();

  await db
    .prepare(
      `INSERT INTO chat_messages (id, room_id, sender_id, body, delivery_status, is_shadow_hidden)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .bind(messageId, roomId, input.fromUserId, body, shadow)
    .run();

  if (!shadow) {
    void (async () => {
      const { notifyQuietly } = await import("@/lib/notifications");
      const actor = await db
        .prepare(`SELECT username FROM "user" WHERE id = ?`)
        .bind(input.fromUserId)
        .first<{ username: string | null }>();
      const label = actor?.username ? `u/${actor.username}` : "Someone";
      notifyQuietly({
        userId: toUser.id,
        actorId: input.fromUserId,
        kind: "chat_request",
        title: `${label} wants to message you`,
        body: body.slice(0, 140),
        href: "/messages",
      });
    })();
  }

  return {
    requestId,
    roomId,
    toUsername: toUser.username ?? input.toUsername,
  };
}

export async function listIncomingRequests(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.room_id, r.opener_body, r.created_at,
         u.username AS from_username, u.image AS from_image, u.name AS from_name
       FROM chat_requests r
       INNER JOIN "user" u ON u.id = r.from_user_id
       WHERE r.to_user_id = ?
         AND r.status = 'pending'
         AND u.status != 'shadowbanned'
         AND NOT EXISTS (
           SELECT 1 FROM chat_messages m
           WHERE m.room_id = r.room_id
             AND m.sender_id = r.from_user_id
             AND m.is_shadow_hidden = 1
             AND m.delivery_status = 'pending'
         )
       ORDER BY r.created_at DESC
       LIMIT 50`
    )
    .bind(userId)
    .all<{
      id: string;
      room_id: string;
      opener_body: string;
      created_at: string;
      from_username: string | null;
      from_image: string | null;
      from_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    openerBody: row.opener_body,
    createdAt: row.created_at,
    from: {
      username: row.from_username,
      image: row.from_image,
      displayName: row.from_name,
    },
  }));
}

export async function respondToChatRequest(input: {
  requestId: string;
  userId: string;
  accept: boolean;
}) {
  const db = await getDb();
  const request = await db
    .prepare(
      `SELECT id, room_id, from_user_id, to_user_id, status
       FROM chat_requests WHERE id = ?`
    )
    .bind(input.requestId)
    .first<{
      id: string;
      room_id: string;
      from_user_id: string;
      to_user_id: string;
      status: string;
    }>();

  if (!request || request.to_user_id !== input.userId) {
    throw new AuthError("Request not found", 404);
  }
  if (request.status !== "pending") {
    throw new AuthError("Request already handled", 409);
  }

  if (input.accept) {
    await db
      .prepare(
        `UPDATE chat_requests
         SET status = 'accepted', responded_at = datetime('now')
         WHERE id = ?`
      )
      .bind(input.requestId)
      .run();
    await db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'active', joined_at = datetime('now')
         WHERE room_id = ? AND user_id = ?`
      )
      .bind(request.room_id, input.userId)
      .run();
    await db
      .prepare(
        `UPDATE chat_messages
         SET delivery_status = 'delivered'
         WHERE room_id = ? AND delivery_status = 'pending' AND is_shadow_hidden = 0`
      )
      .bind(request.room_id)
      .run();

    void (async () => {
      const { notifyQuietly } = await import("@/lib/notifications");
      const actor = await db
        .prepare(`SELECT username FROM "user" WHERE id = ?`)
        .bind(input.userId)
        .first<{ username: string | null }>();
      const label = actor?.username ? `u/${actor.username}` : "Someone";
      notifyQuietly({
        userId: request.from_user_id,
        actorId: input.userId,
        kind: "chat_accepted",
        title: `${label} accepted your message request`,
        href: `/messages?room=${request.room_id}`,
      });
    })();

    return { roomId: request.room_id, status: "accepted" as const };
  }

  await db
    .prepare(
      `UPDATE chat_requests
       SET status = 'declined', responded_at = datetime('now')
       WHERE id = ?`
    )
    .bind(input.requestId)
    .run();
  await db
    .prepare(
      `UPDATE chat_room_members
       SET membership_status = 'declined'
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(request.room_id, input.userId)
    .run();
  return { roomId: request.room_id, status: "declined" as const };
}

export async function listChatRooms(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.last_message_at, r.created_at,
         me.membership_status,
         u.username AS peer_username,
         u.image AS peer_image,
         u.name AS peer_name,
         (
           SELECT body FROM chat_messages cm
           WHERE cm.room_id = r.id
             AND cm.delivery_status = 'delivered'
             AND (cm.is_shadow_hidden = 0 OR cm.sender_id = ?)
           ORDER BY cm.created_at DESC
           LIMIT 1
         ) AS last_body
       FROM chat_rooms r
       INNER JOIN chat_room_members me ON me.room_id = r.id AND me.user_id = ?
       INNER JOIN chat_room_members peer ON peer.room_id = r.id AND peer.user_id != ?
       INNER JOIN "user" u ON u.id = peer.user_id
       WHERE me.membership_status = 'active'
         AND peer.membership_status = 'active'
       ORDER BY COALESCE(r.last_message_at, r.created_at) DESC
       LIMIT 50`
    )
    .bind(userId, userId, userId)
    .all<{
      id: string;
      last_message_at: string | null;
      created_at: string;
      membership_status: string;
      peer_username: string | null;
      peer_image: string | null;
      peer_name: string;
      last_body: string | null;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    peer: {
      username: row.peer_username,
      image: row.peer_image,
      displayName: row.peer_name,
    },
    lastBody: row.last_body,
  }));
}

export async function getChatMessages(input: {
  roomId: string;
  userId: string;
  limit?: number;
}) {
  const db = await getDb();
  const membership = await db
    .prepare(
      `SELECT membership_status FROM chat_room_members
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(input.roomId, input.userId)
    .first<{ membership_status: string }>();

  if (!membership || membership.membership_status !== "active") {
    throw new AuthError("Chat not found", 404);
  }

  const peerActive = await db
    .prepare(
      `SELECT 1 AS ok FROM chat_room_members
       WHERE room_id = ? AND user_id != ? AND membership_status = 'active'`
    )
    .bind(input.roomId, input.userId)
    .first();
  if (!peerActive) {
    throw new AuthError("Chat not found", 404);
  }

  const limit = Math.min(input.limit ?? 100, 200);
  const { results } = await db
    .prepare(
      `SELECT
         m.id, m.body, m.created_at, m.sender_id, m.is_shadow_hidden,
         u.username AS sender_username
       FROM chat_messages m
       INNER JOIN "user" u ON u.id = m.sender_id
       WHERE m.room_id = ?
         AND m.delivery_status = 'delivered'
         AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)
       ORDER BY m.created_at ASC
       LIMIT ?`
    )
    .bind(input.roomId, input.userId, limit)
    .all<{
      id: string;
      body: string;
      created_at: string;
      sender_id: string;
      is_shadow_hidden: number;
      sender_username: string | null;
    }>();

  await db
    .prepare(
      `UPDATE chat_room_members
       SET last_read_at = datetime('now')
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(input.roomId, input.userId)
    .run();

  return (results ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.sender_id === input.userId,
    senderUsername: row.sender_username,
  }));
}

export async function sendChatMessage(input: {
  roomId: string;
  userId: string;
  body: string;
  userStatus?: string | null;
}) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new AuthError("Message must be 1–4000 characters", 400);
  }

  const db = await getDb();
  const membership = await db
    .prepare(
      `SELECT membership_status FROM chat_room_members
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(input.roomId, input.userId)
    .first<{ membership_status: string }>();

  if (!membership || membership.membership_status !== "active") {
    throw new AuthError("Chat not found", 404);
  }

  const peer = await db
    .prepare(
      `SELECT user_id, membership_status FROM chat_room_members
       WHERE room_id = ? AND user_id != ?`
    )
    .bind(input.roomId, input.userId)
    .first<{ user_id: string; membership_status: string }>();

  if (!peer || peer.membership_status !== "active") {
    throw new AuthError("Chat isn't open yet", 403);
  }

  await assertNotBlocked(input.userId, peer.user_id);
  await enforceCreateRateLimit(input.userId, "dm_message");

  const moderation = await moderateText(body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const shadow =
    moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  const id = createPublicId();

  await db
    .prepare(
      `INSERT INTO chat_messages (id, room_id, sender_id, body, delivery_status, is_shadow_hidden)
       VALUES (?, ?, ?, ?, 'delivered', ?)`
    )
    .bind(id, input.roomId, input.userId, body, shadow)
    .run();

  if (!shadow) {
    await db
      .prepare(
        `UPDATE chat_rooms SET last_message_at = datetime('now') WHERE id = ?`
      )
      .bind(input.roomId)
      .run();
  }

  return {
    id,
    body,
    createdAt: new Date().toISOString(),
    isMine: true as const,
  };
}

export async function findActiveRoomWithUsername(
  userId: string,
  username: string
) {
  const peer = await resolveUserByUsername(username);
  if (!peer) return null;
  const db = await getDb();
  const key = pairKey(userId, peer.id);
  const room = await db
    .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
    .bind(key)
    .first<{ id: string }>();
  if (!room) return null;

  const bothActive = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM chat_room_members
       WHERE room_id = ? AND membership_status = 'active'`
    )
    .bind(room.id)
    .first<{ c: number }>();

  if ((bothActive?.c ?? 0) < 2) return null;
  return room.id;
}
