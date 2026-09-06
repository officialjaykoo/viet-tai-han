import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";
import { refreshUnreadCounts } from "@/lib/unread";

export const CHAT_REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "misinformation",
  "nsfw",
  "other",
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];
export type ChatReportStatus = "open" | "reviewed" | "dismissed";

function isChatReportReason(value: unknown): value is ChatReportReason {
  return (
    typeof value === "string" &&
    (CHAT_REPORT_REASONS as readonly string[]).includes(value)
  );
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

export async function reportChatMessage(input: {
  roomId: string;
  messageId: string;
  reporterId: string;
  reason: string;
  details?: string | null;
}) {
  if (!isChatReportReason(input.reason)) {
    throw new AuthError("Invalid report reason", 400);
  }
  const details = input.details?.trim().slice(0, 1000) || null;
  await enforceCreateRateLimit(input.reporterId, "dm_report");

  const db = await getDb();
  const message = await db
    .prepare(
      `SELECT
         m.id, m.room_id, m.sender_id, m.is_shadow_hidden,
         m.is_moderation_hidden, member.membership_status
       FROM chat_messages m
       INNER JOIN chat_room_members member
         ON member.room_id = m.room_id AND member.user_id = ?
       WHERE m.id = ? AND m.room_id = ?`
    )
    .bind(input.reporterId, input.messageId, input.roomId)
    .first<{
      id: string;
      room_id: string;
      sender_id: string;
      is_shadow_hidden: number;
      is_moderation_hidden: number;
      membership_status: string;
    }>();
  if (!message || message.membership_status !== "active") {
    throw new AuthError("Message not found", 404);
  }
  if (message.sender_id === input.reporterId) {
    throw new AuthError("You can't report your own message", 400);
  }
  if (message.is_shadow_hidden || message.is_moderation_hidden) {
    throw new AuthError("Message not found", 404);
  }

  try {
    await db
      .prepare(
        `INSERT INTO chat_message_reports (
           id, message_id, room_id, reporter_id, reason, details
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        createPublicId(),
        input.messageId,
        input.roomId,
        input.reporterId,
        input.reason,
        details
      )
      .run();
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new AuthError("Message already reported", 409);
    }
    throw error;
  }
  return { ok: true as const };
}

const CHAT_REPORT_CONTEXT_LIMIT = 30;

export async function reportChatRoom(input: {
  roomId: string;
  reporterId: string;
  reason: string;
  details?: string | null;
}) {
  if (!isChatReportReason(input.reason)) {
    throw new AuthError("Invalid report reason", 400);
  }
  const details = input.details?.trim().slice(0, 1000) || null;
  await enforceCreateRateLimit(input.reporterId, "dm_report");

  const db = await getDb();
  const membership = await db
    .prepare(
      `SELECT peer.user_id AS reported_user_id
       FROM chat_room_members reporter
       INNER JOIN chat_room_members peer
         ON peer.room_id = reporter.room_id
        AND peer.user_id != reporter.user_id
        AND peer.membership_status = 'active'
       WHERE reporter.room_id = ?
         AND reporter.user_id = ?
         AND reporter.membership_status = 'active'`
    )
    .bind(input.roomId, input.reporterId)
    .first<{ reported_user_id: string }>();
  if (!membership || membership.reported_user_id === input.reporterId) {
    throw new AuthError("Chat not found", 404);
  }

  try {
    await db
      .prepare(
        `INSERT INTO chat_room_reports (
           id, room_id, reporter_id, reported_user_id, reason, details,
           context_until
         ) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))`
      )
      .bind(
        createPublicId(),
        input.roomId,
        input.reporterId,
        membership.reported_user_id,
        input.reason,
        details
      )
      .run();
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new AuthError("Chat already reported", 409);
    }
    throw error;
  }
  return { ok: true as const };
}

export type ChatRoomReportContextMessage = {
  id: string;
  body: string;
  createdAt: string;
  isShadowHidden: boolean;
  isModerationHidden: boolean;
  senderUsername: string | null;
};

export type ChatRoomReportQueueItem = {
  reportType: "conversation";
  id: string;
  roomId: string;
  reporterUsername: string | null;
  reportedUsername: string | null;
  reason: ChatReportReason;
  details: string | null;
  contextUntil: string;
  status: ChatReportStatus;
  createdAt: string;
  context: ChatRoomReportContextMessage[];
};

export async function listChatRoomReports(
  status: ChatReportStatus = "open"
): Promise<ChatRoomReportQueueItem[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason,
         r.details, r.context_until, r.status, r.created_at,
         reporter.username AS reporter_username,
         reported.username AS reported_username
       FROM chat_room_reports r
       INNER JOIN "user" reporter ON reporter.id = r.reporter_id
       INNER JOIN "user" reported ON reported.id = r.reported_user_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC
       LIMIT 100`
    )
    .bind(status)
    .all<{
      id: string;
      room_id: string;
      reporter_username: string | null;
      reported_username: string | null;
      reason: ChatReportReason;
      details: string | null;
      context_until: string;
      status: ChatReportStatus;
      created_at: string;
    }>();

  const reports = results ?? [];
  return Promise.all(
    reports.map(async (row) => {
      const { results: contextRows } = await db
        .prepare(
          `SELECT
             m.id, m.body, m.created_at, m.is_shadow_hidden,
             m.is_moderation_hidden, sender.username AS sender_username
           FROM chat_messages m
           INNER JOIN "user" sender ON sender.id = m.sender_id
           WHERE m.room_id = ?
             AND m.delivery_status = 'delivered'
             AND m.created_at <= ?
           ORDER BY m.created_at DESC
           LIMIT ?`
        )
        .bind(row.room_id, row.context_until, CHAT_REPORT_CONTEXT_LIMIT)
        .all<{
          id: string;
          body: string;
          created_at: string;
          is_shadow_hidden: number;
          is_moderation_hidden: number;
          sender_username: string | null;
        }>();

      return {
        reportType: "conversation" as const,
        id: row.id,
        roomId: row.room_id,
        reporterUsername: row.reporter_username,
        reportedUsername: row.reported_username,
        reason: row.reason,
        details: row.details,
        contextUntil: row.context_until,
        status: row.status,
        createdAt: row.created_at,
        context: (contextRows ?? [])
          .sort(
            (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
          )
          .map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.created_at,
            isShadowHidden: Boolean(message.is_shadow_hidden),
            isModerationHidden: Boolean(message.is_moderation_hidden),
            senderUsername: message.sender_username,
          })),
      };
    })
  );
}

export async function reviewChatRoomReport(input: {
  reportId: string;
  reviewerId: string;
  status: Exclude<ChatReportStatus, "open">;
  resolutionNote?: string | null;
}) {
  const db = await getDb();
  const report = await db
    .prepare(
      `SELECT id, status FROM chat_room_reports
       WHERE id = ?`
    )
    .bind(input.reportId)
    .first<{ id: string; status: ChatReportStatus }>();
  if (!report) throw new AuthError("Report not found", 404);
  if (report.status !== "open") {
    throw new AuthError("Report already handled", 409);
  }

  const result = await db
    .prepare(
      `UPDATE chat_room_reports
       SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'),
           resolution_note = ?
       WHERE id = ? AND status = 'open'`
    )
    .bind(
      input.status,
      input.reviewerId,
      input.resolutionNote?.trim().slice(0, 1000) || null,
      input.reportId
    )
    .run();
  if (!result.meta.changes) {
    throw new AuthError("Report already handled", 409);
  }
  return { ok: true as const, status: input.status };
}


export type ChatMessageReportQueueItem = {
  reportType: "message";
  id: string;
  messageId: string;
  roomId: string;
  messageBody: string;
  messageCreatedAt: string;
  messageIsShadowHidden: boolean;
  messageIsModerationHidden: boolean;
  senderUsername: string | null;
  reporterUsername: string | null;
  peerUsername: string | null;
  reason: ChatReportReason;
  details: string | null;
  status: ChatReportStatus;
  createdAt: string;
};

export async function listChatMessageReports(
  status: ChatReportStatus = "open"
): Promise<ChatMessageReportQueueItem[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.message_id, r.room_id, r.reason, r.details, r.status,
         r.created_at,
         m.body AS message_body,
         m.created_at AS message_created_at,
         m.is_shadow_hidden AS message_is_shadow_hidden,
         m.is_moderation_hidden AS message_is_moderation_hidden,
         sender.username AS sender_username,
         reporter.username AS reporter_username,
         peer.username AS peer_username
       FROM chat_message_reports r
       INNER JOIN chat_messages m ON m.id = r.message_id
       INNER JOIN "user" sender ON sender.id = m.sender_id
       INNER JOIN "user" reporter ON reporter.id = r.reporter_id
       LEFT JOIN chat_room_members peer_member
         ON peer_member.room_id = r.room_id
        AND peer_member.user_id != m.sender_id
       LEFT JOIN "user" peer ON peer.id = peer_member.user_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC
       LIMIT 100`
    )
    .bind(status)
    .all<{
      id: string;
      message_id: string;
      room_id: string;
      reason: ChatReportReason;
      details: string | null;
      status: ChatReportStatus;
      created_at: string;
      message_body: string;
      message_created_at: string;
      message_is_shadow_hidden: number;
      message_is_moderation_hidden: number;
      sender_username: string | null;
      reporter_username: string | null;
      peer_username: string | null;
    }>();

  return (results ?? []).map((row) => ({
    reportType: "message" as const,
    id: row.id,
    messageId: row.message_id,
    roomId: row.room_id,
    messageBody: row.message_body,
    messageCreatedAt: row.message_created_at,
    messageIsShadowHidden: Boolean(row.message_is_shadow_hidden),
    messageIsModerationHidden: Boolean(row.message_is_moderation_hidden),
    senderUsername: row.sender_username,
    reporterUsername: row.reporter_username,
    peerUsername: row.peer_username,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function reviewChatMessageReport(input: {
  reportId: string;
  reviewerId: string;
  status: Exclude<ChatReportStatus, "open">;
  removeMessage?: boolean;
  resolutionNote?: string | null;
}) {
  const db = await getDb();
  const report = await db
    .prepare(
      `SELECT id, message_id, room_id, status
       FROM chat_message_reports WHERE id = ?`
    )
    .bind(input.reportId)
    .first<{
      id: string;
      message_id: string;
      room_id: string;
      status: ChatReportStatus;
    }>();
  if (!report) throw new AuthError("Report not found", 404);
  if (report.status !== "open") {
    throw new AuthError("Report already handled", 409);
  }

  const result = await db
    .prepare(
      `UPDATE chat_message_reports
       SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'),
           resolution_note = ?
       WHERE id = ? AND status = 'open'`
    )
    .bind(
      input.status,
      input.reviewerId,
      input.resolutionNote?.trim().slice(0, 1000) || null,
      input.reportId
    )
    .run();
  if (!result.meta.changes) {
    throw new AuthError("Report already handled", 409);
  }

  if (input.removeMessage) {
    await db
      .prepare(
        `UPDATE chat_messages
         SET is_moderation_hidden = 1
         WHERE id = ? AND room_id = ?`
      )
      .bind(report.message_id, report.room_id)
      .run();
    const { results: members } = await db
      .prepare(
        `SELECT user_id FROM chat_room_members
         WHERE room_id = ? AND membership_status = 'active'`
      )
      .bind(report.room_id)
      .all<{ user_id: string }>();
    await Promise.all(
      (members ?? []).map((member) => refreshUnreadCounts(member.user_id))
    );
  }

  return { ok: true as const, status: input.status };
}

export async function countOpenChatMessageReports(): Promise<number> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM chat_message_reports WHERE status = 'open'`
    )
    .first<{ c: number }>();
  return Number(row?.c ?? 0);
}
