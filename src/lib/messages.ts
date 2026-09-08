import { getDb } from "@/lib/db";
import { runBackgroundTask } from "@/lib/background-task";
import {
  getDmRelationship,
  type DmRelationship,
} from "@/lib/dm-relationships";
import {
  actionableNotificationReadStatements,
  canNotifyChat,
  notifyQuietly,
  reconcileActionableNotification,
} from "@/lib/notifications";
import { formatUserHandle } from "@/lib/profile-url";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import { queuePushDelivery } from "@/lib/push";
import {
  enforceActiveDmRateLimit,
  enforceCreateRateLimit,
} from "@/lib/rate-limit";
import { normalizeRequestId } from "@/lib/idempotency";
import {
  openChatCursor,
  signChatCursor,
  type ChatCursorPosition,
} from "@/lib/security/chat-cursor";
import { AuthError } from "@/lib/session";
import type { ChatHistoryPage, ChatMessage } from "@/lib/types";
import { incrementChatUnread } from "@/lib/unread";

export type ChatPromotionReason =
  | "request_accepted"
  | "friendship"
  | "recipient_followed_sender";

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
  clientMessageId?: string | null;
  /** Legacy alias accepted for existing callers. */
  requestId?: string | null;
};
type ResolvedChatUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  status: string;
};

function normalizeClientMessageId(input: {
  clientMessageId?: string | null;
  requestId?: string | null;
}): string | null {
  return normalizeRequestId(input.clientMessageId || input.requestId);
}
type ChatRoomMember = {
  user_id: string;
  membership_status: string;
};

type ConversationStartContext = {
  input: ConversationStartInput & {
    clientMessageId: string | null;
    requestId: string | null;
  };
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
  const clientMessageId = normalizeClientMessageId(input);
  const normalizedInput = {
    ...input,
    clientMessageId,
    requestId: clientMessageId,
  };
  if (
    typeof input.toUsername !== "string" ||
    typeof input.openerBody !== "string"
  ) {
    throw new AuthError("toUsername and body are required", 400);
  }
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
    input: normalizedInput,
    body,
    toUser,
    relationship,
    db,
    existingRoom,
    members,
  };
}
type ExistingConversationResult =
  | {
      conversationType: "request";
      requestId: string;
      roomId: string;
      toUsername: string;
      clientMessageId: string | null;
      created: false;
    }
  | {
      conversationType: "direct";
      requestId: null;
      roomId: string;
      toUsername: string;
      messageId: string;
      clientMessageId: string | null;
      messageBody: string;
      messageCreatedAt: string;
      created: false;
    };
async function findExistingConversation(
  db: D1Database,
  fromUserId: string,
  requestId: string | null,
  expected?: { recipientId: string; body: string }
): Promise<ExistingConversationResult | null> {
  if (!requestId) return null;

  const requestConditions = expected
    ? " AND r.to_user_id = ? AND r.opener_body = ?"
    : "";
  const requestBindings: Array<string | null> = [fromUserId, requestId];
  if (expected) {
    requestBindings.push(expected.recipientId, expected.body);
  }
  const request = await db
    .prepare(
      `SELECT r.id, r.room_id, r.request_id, u.username
       FROM chat_requests r
       INNER JOIN "user" u ON u.id = r.to_user_id
       WHERE r.from_user_id = ? AND r.request_id = ?${requestConditions}
       LIMIT 1`
    )
    .bind(...requestBindings)
    .first<{
      id: string;
      room_id: string;
      request_id: string | null;
      username: string | null;
    }>();
  if (request) {
    return {
      conversationType: "request",
      requestId: request.id,
      roomId: request.room_id,
      toUsername: request.username ?? "",
      clientMessageId: request.request_id,
      created: false,
    };
  }

  const messageConditions = expected
    ? " AND peer.user_id = ? AND m.body = ?"
    : "";
  const messageBindings: Array<string | null> = [
    fromUserId,
    requestId,
    requestId,
  ];
  if (expected) {
    messageBindings.push(expected.recipientId, expected.body);
  }
  const message = await db
    .prepare(
      `SELECT m.id, m.room_id, m.body, m.created_at, m.client_message_id, u.username
       FROM chat_messages m
       INNER JOIN chat_room_members peer
         ON peer.room_id = m.room_id AND peer.user_id != m.sender_id
       INNER JOIN "user" u ON u.id = peer.user_id
       WHERE m.sender_id = ?
         AND m.delivery_status = 'delivered'
         AND (m.client_message_id = ? OR m.request_id = ?)
         ${messageConditions}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1`
    )
    .bind(...messageBindings)
    .first<{
      id: string;
      room_id: string;
      body: string;
      created_at: string;
      client_message_id: string | null;
      username: string | null;
    }>();
  return message
    ? {
        conversationType: "direct",
        requestId: null,
        roomId: message.room_id,
        toUsername: message.username ?? "",
        messageId: message.id,
        clientMessageId: message.client_message_id,
        messageBody: message.body,
        messageCreatedAt: message.created_at,
        created: false,
      }
    : null;
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

function promotionReasonForRelationship(
  relationship: DmRelationship
): ChatPromotionReason {
  return relationship.friends
    ? "friendship"
    : "recipient_followed_sender";
}

async function notifyChatRequest(input: {
  db: D1Database;
  recipientId: string;
  senderId: string;
  body: string;
  requestId: string;
}) {
  const actor = await input.db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(input.senderId)
    .first<{ username: string | null }>();
  notifyQuietly({
    userId: input.recipientId,
    actorId: input.senderId,
    kind: "chat_request",
    requestId: input.requestId,
    title: `${formatUserHandle(actor?.username)} wants to message you`,
    body: input.body.slice(0, 140),
    href: "/messages",
  });
}

async function notifyChatAccepted(input: {
  db: D1Database;
  recipientId: string;
  accepterId: string;
  roomId: string;
  reason: ChatPromotionReason;
}) {
  const actor = await input.db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(input.accepterId)
    .first<{ username: string | null }>();
  const label = formatUserHandle(actor?.username);
  const title =
    input.reason === "request_accepted"
      ? `${label} accepted your message request`
      : `You can now message ${label} directly`;
  notifyQuietly({
    userId: input.recipientId,
    actorId: input.accepterId,
    kind: "chat_accepted",
    title,
    href: `/messages?room=${input.roomId}`,
  });
}

function notifyDeliveredChatMessage(input: {
  db: D1Database;
  recipientId: string;
  senderId: string;
  roomId: string;
  body: string;
}) {
  runBackgroundTask("chat_unread_fanout", () =>
    incrementChatUnread(input.recipientId, input.senderId)
  );
  runBackgroundTask("chat_push_notification", async () => {
    if (!(await canNotifyChat(input.recipientId, input.senderId))) return;
    const actor = await input.db
      .prepare(`SELECT username FROM "user" WHERE id = ?`)
      .bind(input.senderId)
      .first<{ username: string | null }>();
    queuePushDelivery({
      userId: input.recipientId,
      blockedActorId: input.senderId,
      payload: {
        title: `${formatUserHandle(actor?.username)} sent you a message`,
        body: input.body.slice(0, 140),
        href: `/messages?room=${input.roomId}`,
        tag: `chat-${input.roomId}`,
      },
    });
  });
}

type ChatMessageWrite = {
  message: ChatMessage & { isMine: true };
  created: boolean;
  shouldBroadcast: boolean;
};

type ChatSendTiming = {
  authorizeMs: number;
  rateMs: number;
  moderationMs: number;
  dbWriteMs: number;
  d1ReadStatements: number;
  d1WriteStatements: number;
  d1BatchRoundTrips: number;
};

function createChatSendTiming(): ChatSendTiming {
  return {
    authorizeMs: 0,
    rateMs: 0,
    moderationMs: 0,
    dbWriteMs: 0,
    d1ReadStatements: 0,
    d1WriteStatements: 0,
    d1BatchRoundTrips: 0,
  };
}


type ChatMessageRow = {
  id: string;
  body: string;
  created_at: string;
  client_message_id: string | null;
};

function ownChatMessage(row: ChatMessageRow): ChatMessage & { isMine: true } {
  return {
    id: row.id,
    clientMessageId: row.client_message_id,
    body: row.body,
    createdAt: row.created_at,
    isMine: true,
    senderUsername: null,
  };
}

async function findDeliveredChatMessage(input: {
  db: D1Database;
  roomId: string;
  senderId: string;
  clientMessageId: string | null;
  requestId: string | null;
}): Promise<ChatMessageWrite["message"] | null> {
  if (!input.clientMessageId && !input.requestId) return null;
  const row = await input.db
    .prepare(
      `SELECT id, body, created_at, client_message_id
       FROM chat_messages
       WHERE room_id = ? AND sender_id = ?
         AND delivery_status = 'delivered'
         AND (
           (client_message_id IS NOT NULL AND client_message_id = ?)
           OR (request_id IS NOT NULL AND request_id = ?)
         )
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .bind(
      input.roomId,
      input.senderId,
      input.clientMessageId,
      input.requestId
    )
    .first<ChatMessageRow>();
  return row ? ownChatMessage(row) : null;
}

type ActiveChatSendContext = {
  senderMembershipStatus: string;
  recipientId: string;
  recipientMembershipStatus: string;
  blocked: boolean;
  existingMessage: ChatMessageWrite["message"] | null;
};

async function loadActiveChatSendContext(input: {
  db: D1Database;
  roomId: string;
  senderId: string;
  clientMessageId: string | null;
  requestId: string | null;
}): Promise<ActiveChatSendContext | null> {
  const row = await input.db
    .prepare(
      `SELECT
         me.membership_status AS sender_membership_status,
         peer.user_id AS recipient_id,
         peer.membership_status AS recipient_membership_status,
         EXISTS (
           SELECT 1
           FROM user_blocks b
           WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
              OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
         ) AS blocked,
         duplicate.id AS existing_id,
         duplicate.body AS existing_body,
         duplicate.created_at AS existing_created_at,
         duplicate.client_message_id AS existing_client_message_id
       FROM chat_room_members me
       INNER JOIN chat_room_members peer
         ON peer.room_id = me.room_id
        AND peer.user_id != me.user_id
       LEFT JOIN chat_messages duplicate
         ON duplicate.room_id = me.room_id
        AND duplicate.sender_id = me.user_id
        AND duplicate.delivery_status = 'delivered'
        AND (
          (? IS NOT NULL AND duplicate.client_message_id = ?)
          OR (? IS NOT NULL AND duplicate.request_id = ?)
        )
       WHERE me.room_id = ? AND me.user_id = ?
       LIMIT 1`
    )
    .bind(
      input.clientMessageId,
      input.clientMessageId,
      input.requestId,
      input.requestId,
      input.roomId,
      input.senderId
    )
    .first<{
      sender_membership_status: string;
      recipient_id: string;
      recipient_membership_status: string;
      blocked: number;
      existing_id: string | null;
      existing_body: string | null;
      existing_created_at: string | null;
      existing_client_message_id: string | null;
    }>();

  if (!row) return null;
  return {
    senderMembershipStatus: row.sender_membership_status,
    recipientId: row.recipient_id,
    recipientMembershipStatus: row.recipient_membership_status,
    blocked: Boolean(row.blocked),
    existingMessage:
      row.existing_id &&
      row.existing_body !== null &&
      row.existing_created_at !== null
        ? ownChatMessage({
            id: row.existing_id,
            body: row.existing_body,
            created_at: row.existing_created_at,
            client_message_id: row.existing_client_message_id,
          })
        : null,
  };
}

async function insertDeliveredChatMessage(input: {
  db: D1Database;
  roomId: string;
  senderId: string;
  recipientId: string;
  body: string;
  shadow: number;
  clientMessageId: string | null;
  requestId: string | null;
  existingMessage?: ChatMessageWrite["message"] | null;
}): Promise<ChatMessageWrite> {
  const existing =
    "existingMessage" in input
      ? input.existingMessage
      : await findDeliveredChatMessage(input);
  if (existing) {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "chat_duplicate_retry",
        roomId: input.roomId,
        senderId: input.senderId,
        clientMessageId: input.clientMessageId ?? input.requestId,
        messageId: existing.id,
      })
    );
    return { message: existing, created: false, shouldBroadcast: false };
  }

  const id = createPublicId();
  try {
    const insert = input.db
      .prepare(
        `INSERT INTO chat_messages (
           id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
           request_id, client_message_id, created_at
         )
         SELECT ?, ?, ?, ?, 'delivered', ?, ?, ?,
                strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE EXISTS (
           SELECT 1 FROM chat_room_members
           WHERE room_id = ? AND user_id = ? AND membership_status = 'active'
         )
           AND EXISTS (
             SELECT 1 FROM chat_room_members
             WHERE room_id = ? AND user_id = ? AND membership_status = 'active'
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )
         RETURNING id, body, created_at, client_message_id`
      )
      .bind(
        id,
        input.roomId,
        input.senderId,
        input.body,
        input.shadow,
        input.requestId,
        input.clientMessageId,
        input.roomId,
        input.senderId,
        input.roomId,
        input.recipientId,
        input.senderId,
        input.recipientId,
        input.recipientId,
        input.senderId
      );
    const statements = [insert];
    if (!input.shadow) {
      statements.push(
        input.db
          .prepare(
            `UPDATE chat_rooms
             SET last_message_at = (
               SELECT created_at FROM chat_messages WHERE id = ?
             )
             WHERE id = ?
               AND EXISTS (
                 SELECT 1 FROM chat_messages
                 WHERE id = ? AND delivery_status = 'delivered'
               )
               AND (
                 last_message_at IS NULL
                 OR last_message_at <= (
                   SELECT created_at FROM chat_messages WHERE id = ?
                 )
               )`
          )
          .bind(id, input.roomId, id, id)
      );
    }
    const [insertResult] = await input.db.batch<ChatMessageRow>(statements);
    const row = insertResult?.results?.[0];
    if (!row) {
      await assertNotBlocked(input.senderId, input.recipientId);
      throw new AuthError("Chat is no longer available", 403);
    }
    const message = ownChatMessage(row);
    if (!input.shadow) {
      notifyDeliveredChatMessage({
        db: input.db,
        recipientId: input.recipientId,
        senderId: input.senderId,
        roomId: input.roomId,
        body: message.body,
      });
    }
    return {
      message,
      created: true,
      shouldBroadcast: !input.shadow,
    };
  } catch (error) {
    if (
      isUniqueConstraint(error) &&
      (input.clientMessageId || input.requestId)
    ) {
      const raced = await findDeliveredChatMessage(input);
      if (raced) {
        console.info(
          JSON.stringify({
            level: "info",
            msg: "chat_duplicate_retry",
            roomId: input.roomId,
            senderId: input.senderId,
            clientMessageId: input.clientMessageId ?? input.requestId,
            messageId: raced.id,
          })
        );
        return { message: raced, created: false, shouldBroadcast: false };
      }
    }
    throw error;
  }
}


async function countPendingRequestMessages(
  db: D1Database,
  request: {
    room_id: string;
    from_user_id: string;
    request_id: string | null;
  }
) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM chat_messages
       WHERE room_id = ?
         AND sender_id = ?
         AND delivery_status = 'pending'
         AND is_shadow_hidden = 0
         AND (
           (? IS NOT NULL AND request_id = ?)
           OR (? IS NULL AND request_id IS NULL)
         )`
    )
    .bind(
      request.room_id,
      request.from_user_id,
      request.request_id,
      request.request_id,
      request.request_id
    )
    .first<{ count: number }>();
}

function acceptedChatRepairStatements(
  db: D1Database,
  request: {
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    request_id: string | null;
  }
) {
  return [
    db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'active',
             joined_at = COALESCE(
               joined_at,
               strftime('%Y-%m-%d %H:%M:%f', 'now')
             )
         WHERE room_id = ? AND user_id IN (?, ?)
           AND membership_status IN ('pending', 'active')
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'accepted'
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        request.room_id,
        request.from_user_id,
        request.to_user_id,
        request.id,
        request.from_user_id,
        request.to_user_id,
        request.to_user_id,
        request.from_user_id
      ),
    db
      .prepare(
        `UPDATE chat_messages
         SET delivery_status = 'delivered'
         WHERE room_id = ?
           AND sender_id = ?
           AND delivery_status = 'pending'
           AND is_shadow_hidden = 0
           AND (
             (? IS NOT NULL AND request_id = ?)
             OR (? IS NULL AND request_id IS NULL)
           )
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'accepted'
           )
           AND EXISTS (
             SELECT 1 FROM chat_room_members
             WHERE room_id = ? AND user_id = ? AND membership_status = 'active'
           )
           AND EXISTS (
             SELECT 1 FROM chat_room_members
             WHERE room_id = ? AND user_id = ? AND membership_status = 'active'
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        request.room_id,
        request.from_user_id,
        request.request_id,
        request.request_id,
        request.request_id,
        request.id,
        request.room_id,
        request.from_user_id,
        request.room_id,
        request.to_user_id,
        request.from_user_id,
        request.to_user_id,
        request.to_user_id,
        request.from_user_id
      ),
    db
      .prepare(
        `UPDATE chat_rooms
         SET last_message_at = COALESCE(
           (
             SELECT MAX(created_at)
             FROM chat_messages
             WHERE room_id = ?
               AND delivery_status = 'delivered'
               AND is_shadow_hidden = 0
           ),
           last_message_at
         )
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'accepted'
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        request.room_id,
        request.room_id,
        request.id,
        request.from_user_id,
        request.to_user_id,
        request.to_user_id,
        request.from_user_id
      ),
  ];
}

async function repairAcceptedChatRequest(
  db: D1Database,
  request: {
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    request_id: string | null;
  }
) {
  await db.batch(acceptedChatRepairStatements(db, request));
}

async function promotePendingRequest(
  db: D1Database,
  request: {
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    request_id: string | null;
  },
  reason: ChatPromotionReason
) {
  const pendingMessages = await countPendingRequestMessages(db, request);
  const [requestUpdate] = await db.batch([
    db
      .prepare(
        `UPDATE chat_requests
         SET status = 'accepted',
             responded_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE id = ? AND status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = from_user_id AND blocked_id = to_user_id)
                OR (blocker_id = to_user_id AND blocked_id = from_user_id)
           )`
      )
      .bind(request.id),
    ...acceptedChatRepairStatements(db, request),
    ...actionableNotificationReadStatements(db, {
      recipientId: request.to_user_id,
      actorId: request.from_user_id,
      kind: "chat_request",
      requestId: request.id,
    }),
  ]);

  if (Number(requestUpdate?.meta.changes ?? 0) === 1) {
    const count = Number(pendingMessages?.count ?? 0);
    if (count > 0) {
      runBackgroundTask("chat_unread_fanout", () =>
        incrementChatUnread(request.to_user_id, request.from_user_id, count)
      );
    }
    try {
      await notifyChatAccepted({
        db,
        recipientId: request.from_user_id,
        accepterId: request.to_user_id,
        roomId: request.room_id,
        reason,
      });
    } catch (error) {
      console.error("Failed to notify chat acceptance", error);
    }
    return true;
  }

  const current = await db
    .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
    .bind(request.id)
    .first<{ status: string }>();
  if (current?.status !== "accepted") return false;

  await assertNotBlocked(request.from_user_id, request.to_user_id);
  await reconcileActionableNotification({
    recipientId: request.to_user_id,
    actorId: request.from_user_id,
    kind: "chat_request",
    requestId: request.id,
  });
  const retryPendingMessages = await countPendingRequestMessages(db, request);
  const retryCount = Number(retryPendingMessages?.count ?? 0);
  if (retryCount > 0) {
    runBackgroundTask("chat_unread_fanout", () =>
      incrementChatUnread(request.to_user_id, request.from_user_id, retryCount)
    );
  }
  return true;
}

async function promotePendingRequestsForRoom(
  db: D1Database,
  roomId: string,
  reason: ChatPromotionReason
) {
  const { results } = await db
    .prepare(
      `SELECT id, room_id, from_user_id, to_user_id, request_id
       FROM chat_requests
       WHERE room_id = ? AND status = 'pending'`
    )
    .bind(roomId)
    .all<{
      id: string;
      room_id: string;
      from_user_id: string;
      to_user_id: string;
      request_id: string | null;
    }>();

  let promoted = 0;

  for (const request of results ?? []) {
    try {
      const relationship = await getDmRelationship({
        senderId: request.from_user_id,
        recipientId: request.to_user_id,
      });
      if (!relationship.directAllowed) continue;
      if (await promotePendingRequest(db, request, reason)) promoted += 1;
    } catch (error) {
      console.error("Failed to promote pending chat request", error);
    }
  }
  return promoted;
}

/** Promote pending requests when a follow/friend relationship becomes direct. */
export async function promotePendingChatRequestsForPair(
  firstUserId: string,
  secondUserId: string,
  reason: ChatPromotionReason
) {
  const db = await getDb();
  const room = await db
    .prepare(`SELECT id FROM chat_rooms WHERE pair_key = ?`)
    .bind(pairKey(firstUserId, secondUserId))
    .first<{ id: string }>();
  if (!room) return 0;
  return promotePendingRequestsForRoom(db, room.id, reason);
}

async function createChatRequest(context: ConversationStartContext) {
  const existing = await findExistingConversation(
    context.db,
    context.input.fromUserId,
    context.input.requestId,
    {
      recipientId: context.toUser.id,
      body: context.body,
    }
  );
  if (existing) return existing;
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

  let roomId = context.existingRoom?.id ?? createPublicId();
  let roomCreated = false;
  const requestEntityId = createPublicId();
  const messageId = createPublicId();
  const shadow =
    moderation.shadow || context.input.fromStatus === "shadowbanned" ? 1 : 0;

  if (!context.existingRoom) {
    try {
      const roomWrites = await context.db.batch([
        context.db
          .prepare(
            `INSERT INTO chat_rooms
             (id, kind, pair_key, created_by, last_message_at, created_at)
             SELECT ?, 'dm', ?, ?, NULL, strftime('%Y-%m-%d %H:%M:%f', 'now')
             WHERE NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )`
          )
          .bind(
            roomId,
            pairKey(context.input.fromUserId, context.toUser.id),
            context.input.fromUserId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             SELECT ?, ?, 'owner', 'active',
                    strftime('%Y-%m-%d %H:%M:%f', 'now')
             WHERE EXISTS (
               SELECT 1 FROM chat_rooms WHERE id = ?
             )
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks
                 WHERE (blocker_id = ? AND blocked_id = ?)
                    OR (blocker_id = ? AND blocked_id = ?)
               )`
          )
          .bind(
            roomId,
            context.input.fromUserId,
            roomId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status)
             SELECT ?, ?, 'member', 'pending'
             WHERE EXISTS (
               SELECT 1 FROM chat_rooms WHERE id = ?
             )
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks
                 WHERE (blocker_id = ? AND blocked_id = ?)
                    OR (blocker_id = ? AND blocked_id = ?)
               )`
          )
          .bind(
            roomId,
            context.toUser.id,
            roomId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
      ]);
      if (
        roomWrites.some(
          (result) => Number(result?.meta.changes ?? 0) !== 1
        )
      ) {
        await assertNotBlocked(
          context.input.fromUserId,
          context.toUser.id
        );
        throw new AuthError("Chat is no longer available", 403);
      }
      roomCreated = true;
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

  const statements = [];
  if (context.existingRoom || !roomCreated) {
    statements.push(
      context.db
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'active',
               joined_at = COALESCE(
                 joined_at,
                 strftime('%Y-%m-%d %H:%M:%f', 'now')
               )
           WHERE room_id = ? AND user_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )`
        )
        .bind(
          roomId,
          context.input.fromUserId,
          context.input.fromUserId,
          context.toUser.id,
          context.toUser.id,
          context.input.fromUserId
        ),
      context.db
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'pending', joined_at = NULL
           WHERE room_id = ? AND user_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )`
        )
        .bind(
          roomId,
          context.toUser.id,
          context.input.fromUserId,
          context.toUser.id,
          context.toUser.id,
          context.input.fromUserId
        )
    );
  }
  statements.push(
    context.db
      .prepare(
        `INSERT INTO chat_requests
         (id, room_id, from_user_id, to_user_id, opener_body, status, request_id, created_at)
         SELECT ?, ?, ?, ?, ?, 'pending', ?, strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE NOT EXISTS (
           SELECT 1 FROM user_blocks
           WHERE (blocker_id = ? AND blocked_id = ?)
              OR (blocker_id = ? AND blocked_id = ?)
         )`
      )
      .bind(
        requestEntityId,
        roomId,
        context.input.fromUserId,
        context.toUser.id,
        context.body,
        context.input.requestId,
        context.input.fromUserId,
        context.toUser.id,
        context.toUser.id,
        context.input.fromUserId
      ),
    context.db
      .prepare(
        `INSERT INTO chat_messages (
           id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
           request_id, client_message_id, created_at
         )
         SELECT ?, ?, ?, ?, 'pending', ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE EXISTS (
           SELECT 1 FROM chat_requests
           WHERE id = ? AND status = 'pending'
         )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        messageId,
        roomId,
        context.input.fromUserId,
        context.body,
        shadow,
        context.input.requestId,
        context.input.clientMessageId,
        requestEntityId,
        context.input.fromUserId,
        context.toUser.id,
        context.toUser.id,
        context.input.fromUserId
      ),
    context.db
      .prepare(
        `UPDATE chat_rooms
         SET last_message_at = (
           SELECT created_at FROM chat_messages WHERE id = ?
         )
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM chat_messages
             WHERE id = ? AND delivery_status = 'pending'
           )`
      )
      .bind(messageId, roomId, messageId)
  );
  const requestStatementOffset =
    context.existingRoom || !roomCreated ? 2 : 0;

  try {
    const writeResults = await context.db.batch(statements);
    const activationFailed =
      requestStatementOffset === 2 &&
      writeResults
        .slice(0, requestStatementOffset)
        .some((result) => Number(result?.meta.changes ?? 0) !== 1);
    const requestInsert = writeResults[requestStatementOffset];
    const openerInsert = writeResults[requestStatementOffset + 1];
    if (
      activationFailed ||
      Number(requestInsert?.meta.changes ?? 0) !== 1 ||
      Number(openerInsert?.meta.changes ?? 0) !== 1
    ) {
      await assertNotBlocked(
        context.input.fromUserId,
        context.toUser.id
      );
      const retry = await findExistingConversation(
        context.db,
        context.input.fromUserId,
        context.input.requestId,
        {
          recipientId: context.toUser.id,
          body: context.body,
        }
      );
      if (retry) return retry;
      throw new AuthError("A chat request is already pending", 409);
    }
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const retry = await findExistingConversation(
        context.db,
        context.input.fromUserId,
        context.input.requestId,
        {
          recipientId: context.toUser.id,
          body: context.body,
        }
      );
      if (retry) return retry;
      throw new AuthError("A chat request is already pending", 409);
    }
    throw error;
  }

  if (!shadow) {
    runBackgroundTask("chat_request_notification", () =>
      notifyChatRequest({
        db: context.db,
        recipientId: context.toUser.id,
        senderId: context.input.fromUserId,
        body: context.body,
        requestId: requestEntityId,
      })
    );
  }

  return {
    conversationType: "request" as const,
    requestId: requestEntityId,
    roomId,
    toUsername: context.toUser.username ?? context.input.toUsername,
    clientMessageId: context.input.clientMessageId,
    created: true as const,
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
  await enforceActiveDmRateLimit(context.input.fromUserId);
  const moderation = await moderateText(context.body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  let roomId = context.existingRoom?.id ?? createPublicId();
  let createdRoom = false;
  if (!context.existingRoom) {
    try {
      const roomWrites = await context.db.batch([
        context.db
          .prepare(
            `INSERT INTO chat_rooms
             (id, kind, pair_key, created_by, last_message_at, created_at)
             SELECT ?, 'dm', ?, ?, NULL, strftime('%Y-%m-%d %H:%M:%f', 'now')
             WHERE NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )`
          )
          .bind(
            roomId,
            pairKey(context.input.fromUserId, context.toUser.id),
            context.input.fromUserId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             SELECT ?, ?, 'owner', 'active',
                    strftime('%Y-%m-%d %H:%M:%f', 'now')
             WHERE EXISTS (
               SELECT 1 FROM chat_rooms WHERE id = ?
             )
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks
                 WHERE (blocker_id = ? AND blocked_id = ?)
                    OR (blocker_id = ? AND blocked_id = ?)
               )`
          )
          .bind(
            roomId,
            context.input.fromUserId,
            roomId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
        context.db
          .prepare(
            `INSERT INTO chat_room_members
             (room_id, user_id, role, membership_status, joined_at)
             SELECT ?, ?, 'member', 'active',
                    strftime('%Y-%m-%d %H:%M:%f', 'now')
             WHERE EXISTS (
               SELECT 1 FROM chat_rooms WHERE id = ?
             )
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks
                 WHERE (blocker_id = ? AND blocked_id = ?)
                    OR (blocker_id = ? AND blocked_id = ?)
               )`
          )
          .bind(
            roomId,
            context.toUser.id,
            roomId,
            context.input.fromUserId,
            context.toUser.id,
            context.toUser.id,
            context.input.fromUserId
          ),
      ]);
      if (
        roomWrites.some(
          (result) => Number(result?.meta.changes ?? 0) !== 1
        )
      ) {
        await assertNotBlocked(
          context.input.fromUserId,
          context.toUser.id
        );
        throw new AuthError("Chat is no longer available", 403);
      }
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
    const activation = await context.db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'active',
             joined_at = COALESCE(
               joined_at,
               strftime('%Y-%m-%d %H:%M:%f', 'now')
             )
         WHERE room_id = ? AND user_id IN (?, ?)
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        roomId,
        context.input.fromUserId,
        context.toUser.id,
        context.input.fromUserId,
        context.toUser.id,
        context.toUser.id,
        context.input.fromUserId
      )
      .run();
    if (Number(activation.meta.changes ?? 0) !== 2) {
      await assertNotBlocked(context.input.fromUserId, context.toUser.id);
      throw new AuthError("Chat is no longer available", 403);
    }
    await promotePendingRequestsForRoom(
      context.db,
      roomId,
      promotionReasonForRelationship(context.relationship)
    );
  }

  const shadow =
    moderation.shadow || context.input.fromStatus === "shadowbanned" ? 1 : 0;
  const write = await insertDeliveredChatMessage({
    db: context.db,
    roomId,
    senderId: context.input.fromUserId,
    recipientId: context.toUser.id,
    body: context.body,
    shadow,
    clientMessageId: context.input.clientMessageId,
    requestId: null,
  });
  return {
    conversationType: "direct" as const,
    requestId: null,
    roomId,
    toUsername: context.toUser.username ?? context.input.toUsername,
    messageId: write.message.id,
    clientMessageId: write.message.clientMessageId,
    messageBody: write.message.body,
    messageCreatedAt: write.message.createdAt,
    created: write.created,
    shouldBroadcast: write.shouldBroadcast,
  };
}

/** Start a direct room or a request according to the pairwise policy. */
export async function startConversation(input: ConversationStartInput) {
  const clientMessageId = normalizeClientMessageId(input);
  const context = await prepareConversationStart({
    ...input,
    clientMessageId,
    requestId: clientMessageId,
  });
  if (context.relationship.blocked) {
    throw new AuthError("You can't message this user", 403);
  }
  const existing = await findExistingConversation(
    context.db,
    input.fromUserId,
    clientMessageId,
    {
      recipientId: context.toUser.id,
      body: context.body,
    }
  );
  if (existing) return existing;

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
  const clientMessageId = normalizeClientMessageId(input);
  const context = await prepareConversationStart({
    ...input,
    clientMessageId,
    requestId: clientMessageId,
  });
  if (context.relationship.blocked) {
    throw new AuthError("You can't message this user", 403);
  }
  const existing = await findExistingConversation(
    context.db,
    input.fromUserId,
    clientMessageId,
    {
      recipientId: context.toUser.id,
      body: context.body,
    }
  );
  if (existing) return existing;
  if (
    context.existingRoom &&
    isActiveRoom(
      context.members,
      context.input.fromUserId,
      context.toUser.id
    )
  ) {
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
         AND EXISTS (
           SELECT 1 FROM chat_messages m
           WHERE m.room_id = r.room_id
             AND m.sender_id = r.from_user_id
             AND m.delivery_status = 'pending'
             AND m.is_shadow_hidden = 0
             AND m.is_moderation_hidden = 0
             AND (
               (r.request_id IS NOT NULL AND m.request_id = r.request_id)
               OR (r.request_id IS NULL AND m.request_id IS NULL)
             )
         )
       ORDER BY r.created_at DESC, r.id DESC
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

export async function listOutgoingRequests(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.room_id, r.opener_body, r.created_at,
         u.username AS to_username, u.image AS to_image, u.name AS to_name
       FROM chat_requests r
       INNER JOIN "user" u ON u.id = r.to_user_id
       WHERE r.from_user_id = ?
         AND r.status = 'pending'
         AND u.status != 'shadowbanned'
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = r.from_user_id AND b.blocked_id = r.to_user_id)
              OR (b.blocker_id = r.to_user_id AND b.blocked_id = r.from_user_id)
         )
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 50`
    )
    .bind(userId)
    .all<{
      id: string;
      room_id: string;
      opener_body: string;
      created_at: string;
      to_username: string | null;
      to_image: string | null;
      to_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    openerBody: row.opener_body,
    createdAt: row.created_at,
    to: {
      username: row.to_username,
      image: row.to_image,
      displayName: row.to_name,
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
      `SELECT id, room_id, from_user_id, to_user_id, status, request_id
       FROM chat_requests WHERE id = ?`
    )
    .bind(input.requestId)
    .first<{
      id: string;
      room_id: string;
      from_user_id: string;
      to_user_id: string;
      status: string;
      request_id: string | null;
    }>();

  if (!request || request.to_user_id !== input.userId) {
    throw new AuthError("Request not found", 404);
  }
  if (request.status !== "pending") {
    if (input.accept && request.status === "accepted") {
      await assertNotBlocked(request.from_user_id, request.to_user_id);
      await promotePendingRequest(db, request, "request_accepted");
      return { roomId: request.room_id, status: "accepted" as const };
    }
    if (!input.accept && request.status === "declined") {
      return { roomId: request.room_id, status: "declined" as const };
    }
    throw new AuthError("Request already handled", 409);
  }

  if (input.accept) {
    await assertNotBlocked(request.from_user_id, request.to_user_id);
    const promoted = await promotePendingRequest(
      db,
      request,
      "request_accepted"
    );
    if (!promoted) {
      await assertNotBlocked(request.from_user_id, request.to_user_id);
      throw new AuthError("Request already handled", 409);
    }
    return { roomId: request.room_id, status: "accepted" as const };
  }

  const [requestUpdate] = await db.batch([
    db
      .prepare(
        `UPDATE chat_requests
         SET status = 'declined',
             responded_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE id = ? AND to_user_id = ? AND status = 'pending'`
      )
      .bind(input.requestId, input.userId),
    db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'declined', joined_at = NULL
         WHERE room_id = ? AND user_id = ?
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'declined'
           )`
      )
      .bind(request.room_id, input.userId, request.id),
    db
      .prepare(
        `DELETE FROM chat_messages
         WHERE room_id = ?
           AND sender_id = ?
           AND delivery_status = 'pending'
           AND (
             (? IS NOT NULL AND request_id = ?)
             OR (? IS NULL AND request_id IS NULL)
           )
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'declined'
           )`
      )
      .bind(
        request.room_id,
        request.from_user_id,
        request.request_id,
        request.request_id,
        request.request_id,
        request.id
      ),
    ...actionableNotificationReadStatements(db, {
      recipientId: request.to_user_id,
      actorId: request.from_user_id,
      kind: "chat_request",
      requestId: request.id,
    }),
  ]);
  if (!Number(requestUpdate?.meta.changes ?? 0)) {
    const current = await db
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.id)
      .first<{ status: string }>();
    if (current?.status === "declined") {
      return { roomId: request.room_id, status: "declined" as const };
    }
    throw new AuthError("Request already handled", 409);
  }
  return { roomId: request.room_id, status: "declined" as const };
}
export async function cancelChatRequest(input: {
  requestId: string;
  userId: string;
}) {
  const db = await getDb();
  const request = await db
    .prepare(
      `SELECT id, room_id, from_user_id, to_user_id, status, request_id
       FROM chat_requests
       WHERE id = ?`
    )
    .bind(input.requestId)
    .first<{
      id: string;
      room_id: string;
      from_user_id: string;
      to_user_id: string;
      status: string;
      request_id: string | null;
    }>();

  if (!request || request.from_user_id !== input.userId) {
    throw new AuthError("Request not found", 404);
  }
  if (request.status !== "pending") {
    if (request.status === "cancelled") {
      await reconcileActionableNotification({
        recipientId: request.to_user_id,
        actorId: request.from_user_id,
        kind: "chat_request",
        requestId: request.id,
      });
      return { roomId: request.room_id, status: "cancelled" as const };
    }
    throw new AuthError("Request already handled", 409);
  }

  const [requestUpdate] = await db.batch([
    db
      .prepare(
        `UPDATE chat_requests
         SET status = 'cancelled',
             responded_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
         WHERE id = ? AND from_user_id = ? AND status = 'pending'`
      )
      .bind(request.id, input.userId),
    db
      .prepare(
        `DELETE FROM chat_messages
         WHERE room_id = ?
           AND sender_id = ?
           AND delivery_status = 'pending'
           AND (
             (? IS NOT NULL AND request_id = ?)
             OR (? IS NULL AND request_id IS NULL)
           )
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'cancelled'
           )`
      )
      .bind(
        request.room_id,
        request.from_user_id,
        request.request_id,
        request.request_id,
        request.request_id,
        request.id
      ),
    db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'declined', joined_at = NULL
         WHERE room_id = ? AND user_id = ?
           AND EXISTS (
             SELECT 1 FROM chat_requests
             WHERE id = ? AND status = 'cancelled'
           )`
      )
      .bind(request.room_id, request.to_user_id, request.id),
    ...actionableNotificationReadStatements(db, {
      recipientId: request.to_user_id,
      actorId: request.from_user_id,
      kind: "chat_request",
      requestId: request.id,
    }),
  ]);
  if (!Number(requestUpdate?.meta.changes ?? 0)) {
    const current = await db
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.id)
      .first<{ status: string }>();
    if (current?.status === "cancelled") {
      return { roomId: request.room_id, status: "cancelled" as const };
    }
    throw new AuthError("Request already handled", 409);
  }
  return { roomId: request.room_id, status: "cancelled" as const };
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
         latest.id AS last_message_id,
         latest.body AS last_body,
         (
           SELECT COUNT(*)
           FROM chat_messages unread
           WHERE unread.room_id = r.id
             AND unread.sender_id != me.user_id
             AND unread.delivery_status = 'delivered'
             AND unread.is_shadow_hidden = 0
             AND unread.is_moderation_hidden = 0
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
                  OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
             )
             AND (
               me.last_read_at IS NULL
               OR unread.created_at > me.last_read_at
               OR (
                 unread.created_at = me.last_read_at
                 AND (
                   me.last_read_message_id IS NULL
                   OR unread.id > me.last_read_message_id
                 )
               )
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
       LEFT JOIN chat_messages latest
         ON latest.id = (
           SELECT cm.id
           FROM chat_messages cm
           WHERE cm.room_id = r.id
             AND cm.delivery_status = 'delivered'
             AND cm.is_moderation_hidden = 0
             AND (cm.is_shadow_hidden = 0 OR cm.sender_id = me.user_id)
           ORDER BY cm.created_at DESC, cm.id DESC
           LIMIT 1
         )
       INNER JOIN "user" u ON u.id = peer.user_id
       WHERE NOT EXISTS (
         SELECT 1 FROM user_blocks b
         WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
            OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
       )
       ORDER BY COALESCE(r.last_message_at, r.created_at) DESC, r.id DESC
       LIMIT 50`
    )
    .bind(userId, userId)
    .all<{
      id: string;
      last_message_at: string | null;
      created_at: string;
      membership_status: string;
      peer_username: string | null;
      peer_image: string | null;
      peer_name: string;
      last_message_id: string | null;
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
    lastMessageId: row.last_message_id,
    unreadCount: Number(row.unread_count ?? 0),
  }));
}

type ChatHistoryRow = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  client_message_id: string | null;
  sender_username: string | null;
};

export async function getChatMessages(input: {
  roomId: string;
  userId: string;
  limit?: number;
  before?: string | null;
  after?: string | null;
}): Promise<ChatHistoryPage> {
  if (input.before && input.after) {
    throw new AuthError("Use only one chat history cursor", 400);
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

  let beforePosition: ChatCursorPosition | null = null;
  let afterPosition: ChatCursorPosition | null = null;
  try {
    beforePosition = await openChatCursor(input.before, {
      roomId: input.roomId,
      userId: input.userId,
      direction: "before",
    });
    afterPosition = await openChatCursor(input.after, {
      roomId: input.roomId,
      userId: input.userId,
      direction: "after",
    });
  } catch {
    throw new AuthError("Invalid chat history cursor", 400);
  }

  const pageSize = Math.min(
    Math.max(Math.floor(input.limit ?? 50), 1),
    100
  );
  const selected = pageSize + 1;
  let statement: D1PreparedStatement;
  if (beforePosition) {
    statement = db
      .prepare(
        `SELECT
           m.id, m.body, m.created_at, m.sender_id, m.client_message_id,
           u.username AS sender_username
         FROM chat_messages m
         INNER JOIN "user" u ON u.id = m.sender_id
         WHERE m.room_id = ?
           AND m.delivery_status = 'delivered'
           AND m.is_moderation_hidden = 0
           AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)
           AND (
             m.created_at < ?
             OR (m.created_at = ? AND m.id < ?)
           )
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`
      )
      .bind(
        input.roomId,
        input.userId,
        beforePosition.createdAt,
        beforePosition.createdAt,
        beforePosition.id,
        selected
      );
  } else if (afterPosition) {
    statement = db
      .prepare(
        `SELECT
           m.id, m.body, m.created_at, m.sender_id, m.client_message_id,
           u.username AS sender_username
         FROM chat_messages m
         INNER JOIN "user" u ON u.id = m.sender_id
         WHERE m.room_id = ?
           AND m.delivery_status = 'delivered'
           AND m.is_moderation_hidden = 0
           AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)
           AND (
             m.created_at > ?
             OR (m.created_at = ? AND m.id > ?)
           )
         ORDER BY m.created_at ASC, m.id ASC
         LIMIT ?`
      )
      .bind(
        input.roomId,
        input.userId,
        afterPosition.createdAt,
        afterPosition.createdAt,
        afterPosition.id,
        selected
      );
  } else {
    statement = db
      .prepare(
        `SELECT
           m.id, m.body, m.created_at, m.sender_id, m.client_message_id,
           u.username AS sender_username
         FROM chat_messages m
         INNER JOIN "user" u ON u.id = m.sender_id
         WHERE m.room_id = ?
           AND m.delivery_status = 'delivered'
           AND m.is_moderation_hidden = 0
           AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`
      )
      .bind(input.roomId, input.userId, selected);
  }

  const { results } = await statement.all<ChatHistoryRow>();
  const hasMore = (results?.length ?? 0) > pageSize;
  const pageRows = (results ?? []).slice(0, pageSize);
  if (!afterPosition) pageRows.reverse();
  const messages = pageRows.map((row) => ({
    id: row.id,
    clientMessageId: row.client_message_id,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.sender_id === input.userId,
    senderUsername: row.sender_username,
  }));

  const hasMoreBefore = !afterPosition && hasMore;
  const hasMoreAfter = Boolean(afterPosition) && hasMore;
  const nextBeforeCursor =
    hasMoreBefore && messages.length > 0
      ? await signChatCursor(
          {
            createdAt: messages[0].createdAt,
            id: messages[0].id,
          },
          {
            roomId: input.roomId,
            userId: input.userId,
            direction: "before",
          }
        )
      : null;
  const nextAfterCursor =
    messages.length > 0
      ? await signChatCursor(
          {
            createdAt: messages[messages.length - 1].createdAt,
            id: messages[messages.length - 1].id,
          },
          {
            roomId: input.roomId,
            userId: input.userId,
            direction: "after",
          }
        )
      : null;

  return {
    messages,
    hasMoreBefore,
    nextBeforeCursor,
    hasMoreAfter,
    nextAfterCursor,
  };
}

export async function markChatMessagesRead(input: {
  roomId: string;
  userId: string;
  messageId?: string | null;
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
  if (!peerActive) throw new AuthError("Chat not found", 404);

  const target = input.messageId
    ? await db
        .prepare(
          `SELECT m.id, m.created_at
           FROM chat_messages m
           WHERE m.id = ?
             AND m.room_id = ?
             AND m.delivery_status = 'delivered'
             AND m.is_moderation_hidden = 0
             AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)`
        )
        .bind(input.messageId, input.roomId, input.userId)
        .first<{ id: string; created_at: string }>()
    : await db
        .prepare(
          `SELECT m.id, m.created_at
           FROM chat_messages m
           WHERE m.room_id = ?
             AND m.delivery_status = 'delivered'
             AND m.is_moderation_hidden = 0
             AND (m.is_shadow_hidden = 0 OR m.sender_id = ?)
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1`
        )
        .bind(input.roomId, input.userId)
        .first<{ id: string; created_at: string }>();

  if (!target) {
    if (input.messageId) throw new AuthError("Message not found", 404);
    return { roomId: input.roomId, messageId: null, updated: false };
  }

  const update = await db
    .prepare(
      `UPDATE chat_room_members
       SET last_read_at = ?, last_read_message_id = ?
       WHERE room_id = ? AND user_id = ?
         AND membership_status = 'active'
         AND (
           last_read_at IS NULL
           OR last_read_at < ?
           OR (
             last_read_at = ?
             AND (
               last_read_message_id IS NULL
               OR last_read_message_id < ?
             )
           )
         )`
    )
    .bind(
      target.created_at,
      target.id,
      input.roomId,
      input.userId,
      target.created_at,
      target.created_at,
      target.id
    )
    .run();

  return {
    roomId: input.roomId,
    messageId: target.id,
    updated: Number(update.meta.changes ?? 0) === 1,
  };
}

export async function sendChatMessage(input: {
  roomId: string;
  userId: string;
  body: string;
  userStatus?: string | null;
  clientMessageId?: string | null;
  /** Legacy alias retained for older clients. */
  requestId?: string | null;
}) {
  const totalStartedAt = performance.now();
  if (typeof input.body !== "string") {
    throw new AuthError("Message must be 1–4000 characters", 400);
  }
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new AuthError("Message must be 1–4000 characters", 400);
  }
  const clientMessageId = normalizeRequestId(input.clientMessageId);
  const requestId = clientMessageId
    ? null
    : normalizeRequestId(input.requestId);
  const timing = createChatSendTiming();
  const db = await getDb();

  const authorizeStartedAt = performance.now();
  const context = await loadActiveChatSendContext({
    db,
    roomId: input.roomId,
    senderId: input.userId,
    clientMessageId,
    requestId,
  });
  timing.authorizeMs = performance.now() - authorizeStartedAt;
  timing.d1ReadStatements = 1;

  if (!context) {
    throw new AuthError("Chat not found", 404);
  }
  if (context.blocked) {
    throw new AuthError("You can't message this user", 403);
  }
  if (context.senderMembershipStatus !== "active") {
    throw new AuthError("Chat not found", 404);
  }
  if (context.recipientMembershipStatus !== "active") {
    throw new AuthError("Chat isn't open yet", 403);
  }
  if (context.existingMessage) {
    return {
      ...context.existingMessage,
      created: false as const,
      shouldBroadcast: false as const,
      serverTiming: {
        ...timing,
        totalMs: performance.now() - totalStartedAt,
      },
    };
  }

  const rateStartedAt = performance.now();
  await enforceActiveDmRateLimit(input.userId);
  timing.rateMs = performance.now() - rateStartedAt;

  const moderationStartedAt = performance.now();
  const moderation = await moderateText(body);
  timing.moderationMs = performance.now() - moderationStartedAt;
  timing.d1ReadStatements += moderation.d1ReadStatements;
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const shadow =
    moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  const dbWriteStartedAt = performance.now();
  const write = await insertDeliveredChatMessage({
    db,
    roomId: input.roomId,
    senderId: input.userId,
    recipientId: context.recipientId,
    body,
    shadow,
    clientMessageId,
    requestId,
    existingMessage: context.existingMessage,
  });
  timing.dbWriteMs = performance.now() - dbWriteStartedAt;
  if (write.created) {
    timing.d1WriteStatements = shadow ? 1 : 2;
    timing.d1BatchRoundTrips = 1;
  }

  return {
    ...write.message,
    created: write.created,
    shouldBroadcast: write.shouldBroadcast,
    serverTiming: {
      ...timing,
      totalMs: performance.now() - totalStartedAt,
    },
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
