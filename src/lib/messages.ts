import { getDb } from "@/lib/db";
import {
  getDmRelationship,
  type DmRelationship,
} from "@/lib/dm-relationships";
import { canNotifyChat } from "@/lib/notifications";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import { queuePushDelivery } from "@/lib/push";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";
import { incrementUnread, refreshUnreadCounts } from "@/lib/unread";

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

type ConversationStartInput = {
  fromUserId: string;
  toUsername: string;
  openerBody: string;
  fromStatus?: string | null;
};

type ResolvedChatUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  status: string;
};

type ChatRoomMember = {
  user_id: string;
  membership_status: string;
};

type ConversationStartContext = {
  input: ConversationStartInput;
  body: string;
  toUser: ResolvedChatUser;
  relationship: DmRelationship;
  db: D1Database;
  existingRoom: { id: string } | null;
  members: ChatRoomMember[];
};

async function resolveUserByUsername(
  username: string
): Promise<ResolvedChatUser | null> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id, username, name, image, status
       FROM "user"
       WHERE username = ? COLLATE NOCASE AND status != 'banned'`
    )
    .bind(username.trim())
    .first<ResolvedChatUser>();
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

function isActiveRoom(
  members: ChatRoomMember[],
  firstUserId: string,
  secondUserId: string
): boolean {
  return (
    members.some(
      (member) =>
        member.user_id === firstUserId &&
        member.membership_status === "active"
    ) &&
    members.some(
      (member) =>
        member.user_id === secondUserId &&
        member.membership_status === "active"
    )
  );
}

async function loadRoomMembers(
  db: D1Database,
  roomId: string
): Promise<ChatRoomMember[]> {
  const { results } = await db
    .prepare(
      `SELECT user_id, membership_status
       FROM chat_room_members
       WHERE room_id = ?`
    )
    .bind(roomId)
    .all<ChatRoomMember>();
  return results ?? [];
}

async function prepareConversationStart(
  input: ConversationStartInput
): Promise<ConversationStartContext> {
  const body = input.openerBody.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new AuthError("Message must be 1–4000 characters", 400);
  }

  const toUser = await resolveUserByUsername(input.toUsername);
  if (!toUser) {
    throw new AuthError("User not found", 404);
  }
  if (toUser.id === input.fromUserId) {
    throw new AuthError("You can't message yourself", 400);
  }

  const relationship = await getDmRelationship({
    senderId: input.fromUserId,
    recipientId: toUser.id,
  });
  const db = await getDb();
  const existingRoom = await db
    .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
    .bind(pairKey(input.fromUserId, toUser.id))
    .first<{ id: string }>();
  const members = existingRoom
    ? await loadRoomMembers(db, existingRoom.id)
    : [];

  return {
    input,
    body,
    toUser,
    relationship,
    db,
    existingRoom,
    members,
  };
}

function assertRelationshipCanMessage(
  relationship: DmRelationship,
  requireDirect: boolean
) {
  if (relationship.blocked) {
    throw new AuthError("You can't message this user", 403);
  }
  if (
    requireDirect
      ? !relationship.directAllowed
      : !relationship.requestAllowed
  ) {
    throw new AuthError("This user isn't accepting chat requests", 403);
  }
}

async function notifyChatRequest(input: {
  db: D1Database;
  recipientId: string;
  senderId: string;
  body: string;
}) {
  const actor = await input.db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(input.senderId)
    .first<{ username: string | null }>();
  const label = actor?.username ? `u/${actor.username}` : "Someone";
  const { notifyQuietly } = await import("@/lib/notifications");
  notifyQuietly({
    userId: input.recipientId,
    actorId: input.senderId,
    kind: "chat_request",
    title: `${label} wants to message you`,
    body: input.body.slice(0, 140),
    href: "/messages",
  });
}

async function notifyChatAccepted(input: {
  db: D1Database;
  recipientId: string;
  accepterId: string;
  roomId: string;
}) {
  const actor = await input.db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(input.accepterId)
    .first<{ username: string | null }>();
  const label = actor?.username ? `u/${actor.username}` : "Someone";
  const { notifyQuietly } = await import("@/lib/notifications");
  notifyQuietly({
    userId: input.recipientId,
    actorId: input.accepterId,
    kind: "chat_accepted",
    title: `${label} accepted your message request`,
    href: `/messages?room=${input.roomId}`,
  });
}

async function notifyDeliveredChatMessage(input: {
  db: D1Database;
  recipientId: string;
  senderId: string;
  roomId: string;
  body: string;
}) {
  await incrementUnread(input.recipientId, "messages");
  void (async () => {
    if (!(await canNotifyChat(input.recipientId))) return;
    const actor = await input.db
      .prepare(`SELECT username FROM "user" WHERE id = ?`)
      .bind(input.senderId)
      .first<{ username: string | null }>();
    const label = actor?.username ? `u/${actor.username}` : "Someone";
    queuePushDelivery({
      userId: input.recipientId,
      payload: {
        title: `${label} sent you a message`,
        body: input.body.slice(0, 140),
        href: `/messages?room=${input.roomId}`,
        tag: `chat-${input.roomId}`,
      },
    });
  })().catch((error) => {
    console.error("chat push notification failed", error);
  });
}

async function insertDeliveredChatMessage(input: {
  db: D1Database;
  roomId: string;
  senderId: string;
  recipientId: string;
  body: string;
  shadow: number;
}) {
  const id = createPublicId();
  await input.db
    .prepare(
      `INSERT INTO chat_messages (
         id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
         created_at
       ) VALUES (?, ?, ?, ?, 'delivered', ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))`
    )
    .bind(id, input.roomId, input.senderId, input.body, input.shadow)
    .run();

  if (!input.shadow) {
    await input.db
      .prepare(
        `UPDATE chat_rooms
         SET last_message_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE id = ?`
      )
      .bind(input.roomId)
      .run();
    await notifyDeliveredChatMessage({
      db: input.db,
      recipientId: input.recipientId,
      senderId: input.senderId,
      roomId: input.roomId,
      body: input.body,
    });
  }

  return {
    id,
    body: input.body,
    createdAt: new Date().toISOString(),
    isMine: true as const,
  };
}

async function promotePendingRequest(
  db: D1Database,
  request: {
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
  }
) {
  const pendingMessages = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM chat_messages
       WHERE room_id = ?
         AND sender_id = ?
         AND delivery_status = 'pending'
         AND is_shadow_hidden = 0`
    )
    .bind(request.room_id, request.from_user_id)
    .first<{ count: number }>();

  const updated = await db.batch([
    db
      .prepare(
        `UPDATE chat_requests
         SET status = 'accepted', responded_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      )
      .bind(request.id),
    db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'active', joined_at = datetime('now')
         WHERE room_id = ? AND user_id IN (?, ?)`
      )
      .bind(request.room_id, request.from_user_id, request.to_user_id),
    db
      .prepare(
        `UPDATE chat_messages
         SET delivery_status = 'delivered'
         WHERE room_id = ? AND delivery_status = 'pending'
           AND is_shadow_hidden = 0`
      )
      .bind(request.room_id),
  ]);

  if (!updated[0]?.meta.changes) return false;

  const count = Number(pendingMessages?.count ?? 0);
  if (count > 0) {
    await incrementUnread(request.to_user_id, "messages", count);
  }
  await notifyChatAccepted({
    db,
    recipientId: request.from_user_id,
    accepterId: request.to_user_id,
    roomId: request.room_id,
  });
  return true;
}

async function promotePendingRequestsForRoom(
  db: D1Database,
  roomId: string
) {
  const { results } = await db
    .prepare(
      `SELECT id, room_id, from_user_id, to_user_id
       FROM chat_requests
       WHERE room_id = ? AND status = 'pending'`
    )
    .bind(roomId)
    .all<{
      id: string;
      room_id: string;
      from_user_id: string;
      to_user_id: string;
    }>();

  let promoted = 0;
  for (const request of results ?? []) {
    const relationship = await getDmRelationship({
      senderId: request.from_user_id,
      recipientId: request.to_user_id,
    });
    if (!relationship.directAllowed) continue;
    if (await promotePendingRequest(db, request)) promoted += 1;
  }
  return promoted;
}

/** Promote pending requests when a follow/friend relationship becomes direct. */
export async function promotePendingChatRequestsForPair(
  firstUserId: string,
  secondUserId: string
) {
  const db = await getDb();
  const room = await db
    .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
    .bind(pairKey(firstUserId, secondUserId))
    .first<{ id: string }>();
  if (!room) return 0;
  return promotePendingRequestsForRoom(db, room.id);
}

async function createChatRequest(context: ConversationStartContext) {
  assertRelationshipCanMessage(context.relationship, false);
  await assertNotBlocked(context.input.fromUserId, context.toUser.id);
  if (context.body.length > 2000) {
    throw new AuthError("Message must be 1–2000 characters", 400);
  }

  await enforceCreateRateLimit(context.input.fromUserId, "dm_request");
  const moderation = await moderateText(context.body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const roomId = context.existingRoom?.id ?? createPublicId();
  const requestId = createPublicId();
  const messageId = createPublicId();
  const shadow =
    moderation.shadow || context.input.fromStatus === "shadowbanned" ? 1 : 0;

  if (!context.existingRoom) {
    try {
      await context.db.batch([
        context.db
          .prepare(
            `INSERT INTO chat_rooms (id, kind, pair_key, created_by, last_message_at)
             VALUES (?, 'dm', ?, ?, datetime('now'))`
          )
          .bind(
            roomId,
            pairKey(context.input.fromUserId, context.toUser.id),
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             VALUES (?, ?, 'owner', 'active', datetime('now'))`
          )
          .bind(roomId, context.input.fromUserId),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status)
             VALUES (?, ?, 'member', 'pending')`
          )
          .bind(roomId, context.toUser.id),
      ]);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AuthError("Chat already exists", 409);
      }
      throw error;
    }
  } else {
    const pending = await context.db
      .prepare(
        `SELECT id FROM chat_requests
         WHERE room_id = ? AND status = 'pending'
         LIMIT 1`
      )
      .bind(roomId)
      .first<{ id: string }>();
    if (pending) {
      throw new AuthError("A chat request is already pending", 409);
    }
    await context.db.batch([
      context.db
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'active', joined_at = COALESCE(joined_at, datetime('now'))
           WHERE room_id = ? AND user_id = ?`
        )
        .bind(roomId, context.input.fromUserId),
      context.db
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'pending', joined_at = NULL
           WHERE room_id = ? AND user_id = ?`
        )
        .bind(roomId, context.toUser.id),
    ]);
  }

  try {
    await context.db
      .prepare(
        `INSERT INTO chat_requests
         (id, room_id, from_user_id, to_user_id, opener_body, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        requestId,
        roomId,
        context.input.fromUserId,
        context.toUser.id,
        context.body
      )
      .run();
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new AuthError("A chat request is already pending", 409);
    }
    throw error;
  }

  await context.db
    .prepare(
      `INSERT INTO chat_messages (
         id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
         created_at
       ) VALUES (?, ?, ?, ?, 'pending', ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))`
    )
    .bind(
      messageId,
      roomId,
      context.input.fromUserId,
      context.body,
      shadow
    )
    .run();

  if (!shadow) {
    void notifyChatRequest({
      db: context.db,
      recipientId: context.toUser.id,
      senderId: context.input.fromUserId,
      body: context.body,
    });
  }

  return {
    conversationType: "request" as const,
    requestId,
    roomId,
    toUsername: context.toUser.username ?? context.input.toUsername,
  };
}

async function startDirectConversation(
  context: ConversationStartContext,
  allowEstablishedRoom: boolean
) {
  if (!allowEstablishedRoom) {
    assertRelationshipCanMessage(context.relationship, true);
  } else if (context.relationship.blocked) {
    throw new AuthError("You can't message this user", 403);
  }
  await assertNotBlocked(context.input.fromUserId, context.toUser.id);
  await enforceCreateRateLimit(context.input.fromUserId, "dm_message");
  const moderation = await moderateText(context.body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  let roomId = context.existingRoom?.id ?? createPublicId();
  let createdRoom = false;
  if (!context.existingRoom) {
    try {
      await context.db.batch([
        context.db
          .prepare(
            `INSERT INTO chat_rooms (id, kind, pair_key, created_by, last_message_at)
             VALUES (?, 'dm', ?, ?, datetime('now'))`
          )
          .bind(
            roomId,
            pairKey(context.input.fromUserId, context.toUser.id),
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             VALUES (?, ?, 'owner', 'active', datetime('now'))`
          )
          .bind(roomId, context.input.fromUserId),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             VALUES (?, ?, 'member', 'active', datetime('now'))`
          )
          .bind(roomId, context.toUser.id),
      ]);
      createdRoom = true;
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const racedRoom = await context.db
        .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
        .bind(pairKey(context.input.fromUserId, context.toUser.id))
        .first<{ id: string }>();
      if (!racedRoom) throw error;
      roomId = racedRoom.id;
    }
  }

  if (context.existingRoom || !createdRoom) {
    await context.db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'active', joined_at = COALESCE(joined_at, datetime('now'))
         WHERE room_id = ? AND user_id IN (?, ?)`
      )
      .bind(roomId, context.input.fromUserId, context.toUser.id)
      .run();
    await promotePendingRequestsForRoom(context.db, roomId);
  }

  const shadow =
    moderation.shadow || context.input.fromStatus === "shadowbanned" ? 1 : 0;
  return insertDeliveredChatMessage({
    db: context.db,
    roomId,
    senderId: context.input.fromUserId,
    recipientId: context.toUser.id,
    body: context.body,
    shadow,
  }).then((message) => ({
    conversationType: "direct" as const,
    requestId: null,
    roomId,
    toUsername: context.toUser.username ?? context.input.toUsername,
    messageId: message.id,
  }));
}

/** Start a direct room or a request according to the pairwise policy. */
export async function startConversation(input: ConversationStartInput) {
  const context = await prepareConversationStart(input);
  if (context.relationship.blocked) {
    throw new AuthError("You can't message this user", 403);
  }

  if (
    context.existingRoom &&
    isActiveRoom(
      context.members,
      context.input.fromUserId,
      context.toUser.id
    )
  ) {
    // Existing active rooms survive privacy changes and unfollows.
    return startDirectConversation(context, true);
  }
  if (context.relationship.directAllowed) {
    return startDirectConversation(context, false);
  }
  return createChatRequest(context);
}

/** Direct-only entrypoint for relationship-aware message buttons. */
export async function startDirectChat(input: ConversationStartInput) {
  const context = await prepareConversationStart(input);
  if (context.existingRoom && isActiveRoom(
    context.members,
    context.input.fromUserId,
    context.toUser.id
  )) {
    return startDirectConversation(context, true);
  }
  return startDirectConversation(context, false);
}

/** Backwards-compatible internal entrypoint; it now applies the full policy. */
export async function startChatRequest(input: ConversationStartInput) {
  return startConversation(input);
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
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = r.from_user_id AND b.blocked_id = r.to_user_id)
              OR (b.blocker_id = r.to_user_id AND b.blocked_id = r.from_user_id)
         )
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
    await assertNotBlocked(request.from_user_id, request.to_user_id);
    const promoted = await promotePendingRequest(db, request);
    if (!promoted) {
      throw new AuthError("Request already handled", 409);
    }
    return { roomId: request.room_id, status: "accepted" as const };
  }

  const requestUpdate = await db
    .prepare(
      `UPDATE chat_requests
       SET status = 'declined', responded_at = datetime('now')
       WHERE id = ? AND to_user_id = ? AND status = 'pending'`
    )
    .bind(input.requestId, input.userId)
    .run();
  if (!requestUpdate.meta.changes) {
    throw new AuthError("Request already handled", 409);
  }
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
             AND cm.is_moderation_hidden = 0
             AND (cm.is_shadow_hidden = 0 OR cm.sender_id = ?)
           ORDER BY cm.created_at DESC
           LIMIT 1
         ) AS last_body,
         (
           SELECT COUNT(*)
           FROM chat_messages unread
           WHERE unread.room_id = r.id
             AND unread.sender_id != me.user_id
             AND unread.delivery_status = 'delivered'
             AND unread.is_shadow_hidden = 0
             AND unread.is_moderation_hidden = 0
             AND (
               me.last_read_at IS NULL
               OR unread.created_at > me.last_read_at
             )
         ) AS unread_count
       FROM chat_rooms r
       INNER JOIN chat_room_members me
         ON me.room_id = r.id
        AND me.user_id = ?
        AND me.membership_status = 'active'
       INNER JOIN chat_room_members peer
         ON peer.room_id = r.id
        AND peer.user_id != ?
        AND peer.membership_status = 'active'
       INNER JOIN "user" u ON u.id = peer.user_id
       WHERE NOT EXISTS (
         SELECT 1 FROM user_blocks b
         WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
            OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
       )
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
      unread_count: number;
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
    unreadCount: Number(row.unread_count ?? 0),
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
      `SELECT membership_status, last_read_at FROM chat_room_members
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(input.roomId, input.userId)
    .first<{ membership_status: string; last_read_at: string | null }>();

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
         AND m.is_moderation_hidden = 0
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
       SET last_read_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
       WHERE room_id = ? AND user_id = ?`
    )
    .bind(input.roomId, input.userId)
    .run();
  await refreshUnreadCounts(input.userId);

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
  return insertDeliveredChatMessage({
    db,
    roomId: input.roomId,
    senderId: input.userId,
    recipientId: peer.user_id,
    body,
    shadow,
  });
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
