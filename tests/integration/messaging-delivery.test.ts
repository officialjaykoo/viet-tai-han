import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  createNotification,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";
import {
  getChatMessages,
  listChatRooms,
  markChatMessagesRead,
  respondToChatRequest,
  startChatRequest,
  sendChatMessage,
  listIncomingRequests,
} from "@/lib/messages";
import {
  listChatMessageReports,
  listChatRoomReports,
  reportChatMessage,
  reportChatRoom,
  reviewChatMessageReport,
} from "@/lib/dm-moderation";
import { getUnreadCounts } from "@/lib/unread";
import { seedUsersAndSubreddit } from "./helpers";

async function usernameFor(userId: string): Promise<string> {
  const row = await env.DB
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(userId)
    .first<{ username: string }>();
  if (!row?.username) throw new Error("seed user has no username");
  return row.username;
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("messaging delivery (D1)", () => {
  it("fans out unread counts, marks messages read, and moderates reports", async () => {
    const { authorId, actorId } = await seedUsersAndSubreddit();
    const actorUsername = await usernameFor(actorId);
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: actorUsername,
      openerBody: "Hello from the delivery test.",
      fromStatus: "active",
    });

    expect((await listIncomingRequests(actorId)).some((item) => item.id === request.requestId)).toBe(
      true
    );
    await respondToChatRequest({
      requestId: request.requestId,
      userId: actorId,
      accept: true,
    });
    await flushBackgroundWork();
    const acceptedNotifications = await listNotifications(authorId);
    expect(
      acceptedNotifications.some(
        (notification) =>
          notification.kind === "chat_accepted" &&
          notification.title.includes("accepted your message request")
      )
    ).toBe(true);
    const initialHistory = await getChatMessages({
      roomId: request.roomId,
      userId: actorId,
    });
    await markChatMessagesRead({
      roomId: request.roomId,
      userId: actorId,
      messageId:
        initialHistory.messages[initialHistory.messages.length - 1]?.id,
    });

    const sent = await sendChatMessage({
      roomId: request.roomId,
      userId: authorId,
      body: "Please review this message.",
      userStatus: "active",
    });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(1);
    expect((await listChatRooms(actorId))[0]?.unreadCount).toBe(1);

    const visible = await getChatMessages({
      roomId: request.roomId,
      userId: actorId,
    });
    expect(visible.messages.some((message) => message.id === sent.id)).toBe(
      true
    );
    await markChatMessagesRead({
      roomId: request.roomId,
      userId: actorId,
      messageId: sent.id,
    });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(0);

    await reportChatMessage({
      roomId: request.roomId,
      messageId: sent.id,
      reporterId: actorId,
      reason: "harassment",
      details: "Test moderation report",
    });
    await expect(
      reportChatMessage({
        roomId: request.roomId,
        messageId: sent.id,
        reporterId: actorId,
        reason: "harassment",
      })
    ).rejects.toMatchObject({ status: 409 });

    const reports = await listChatMessageReports();
    const report = reports.find((item) => item.messageId === sent.id);
    expect(report?.reason).toBe("harassment");
    await reviewChatMessageReport({
      reportId: report!.id,
      reviewerId: authorId,
      status: "reviewed",
      removeMessage: true,
    });
    expect(
      (await getChatMessages({ roomId: request.roomId, userId: actorId }))
        .messages.some((message) => message.id === sent.id)
    ).toBe(false);

  });
  it("reports a bounded conversation context and validates membership", async () => {
    const { authorId, actorId } = await seedUsersAndSubreddit();
    const outsiderId = `u_outsider_${crypto.randomUUID().slice(0, 8)}`;
    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
       VALUES (?, 'Outsider', ?, 1, ?, 40, 'user', 'active')`
    )
      .bind(
        outsiderId,
        `${outsiderId}@test.local`,
        `outsider_${outsiderId.slice(-8)}`
      )
      .run();
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: await usernameFor(actorId),
      openerBody: "Conversation context opener.",
      fromStatus: "active",
    });
    await respondToChatRequest({
      requestId: request.requestId,
      userId: actorId,
      accept: true,
    });
    await env.DB.prepare(
      `UPDATE chat_messages
       SET created_at = '2020-01-01 00:00:00.000'
       WHERE room_id = ?`
    )
      .bind(request.roomId)
      .run();

    for (let index = 0; index < 35; index += 1) {
      const createdAt = new Date(Date.UTC(2020, 0, 1, 0, index))
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      await env.DB.prepare(
        `INSERT INTO chat_messages (
           id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
           created_at
         ) VALUES (?, ?, ?, ?, 'delivered', 0, ?)`
      )
        .bind(
          crypto.randomUUID(),
          request.roomId,
          authorId,
          `Context message ${index}`,
          createdAt
        )
        .run();
    }
    await reportChatRoom({
      roomId: request.roomId,
      reporterId: actorId,
      reason: "harassment",
      details: "Review the recent conversation.",
    });
    await env.DB.prepare(
      `INSERT INTO chat_messages (
         id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
         created_at
       ) VALUES (?, ?, ?, 'Message after report', 'delivered', 0, '2099-01-01 00:00:00.000')`
    )
      .bind(crypto.randomUUID(), request.roomId, authorId)
      .run();

    const reports = await listChatRoomReports();
    const report = reports.find((item) => item.roomId === request.roomId);
    expect(report?.context).toHaveLength(30);
    expect(report?.context.at(-1)?.body).toBe("Context message 34");
    expect(report?.context.some((message) => message.body === "Message after report")).toBe(
      false
    );
    expect(report?.reportedUsername).toContain("author_");

    await expect(
      reportChatRoom({
        roomId: request.roomId,
        reporterId: actorId,
        reason: "harassment",
      })
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      reportChatRoom({
        roomId: request.roomId,
        reporterId: outsiderId,
        reason: "harassment",
      })
    ).rejects.toMatchObject({ status: 404 });

    const stored = await env.DB.prepare(
      `SELECT reporter_id, reported_user_id, context_until
       FROM chat_room_reports WHERE id = ?`
    )
      .bind(report!.id)
      .first<{
        reporter_id: string;
        reported_user_id: string;
        context_until: string;
      }>();
    expect(stored).toMatchObject({
      reporter_id: actorId,
      reported_user_id: authorId,
    });
    expect(stored?.context_until).toBeTruthy();

    await reportChatMessage({
      roomId: request.roomId,
      messageId: report!.context[0]!.id,
      reporterId: actorId,
      reason: "spam",
    });
    expect(
      (await listChatMessageReports()).some(
        (item) => item.messageId === report!.context[0]!.id
      )
    ).toBe(true);
  });
  it("makes concurrent request acceptance idempotent", async () => {
    const { authorId, actorId } = await seedUsersAndSubreddit();
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: await usernameFor(actorId),
      openerBody: "Accept this exactly once.",
      fromStatus: "active",
    });
    const outcomes = await Promise.allSettled([
      respondToChatRequest({
        requestId: request.requestId,
        userId: actorId,
        accept: true,
      }),
      respondToChatRequest({
        requestId: request.requestId,
        userId: actorId,
        accept: true,
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled")
    ).toHaveLength(2);
    expect(
      outcomes.every(
        (outcome) =>
          outcome.status === "fulfilled" && outcome.value.status === "accepted"
      )
    ).toBe(true);
    expect(
      await env.DB
        .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
        .bind(request.requestId)
        .first<{ status: string }>()
    ).toEqual({ status: "accepted" });
  });

  it("keeps notification fanout in sync when notifications are read", async () => {
    const { authorId, actorId } = await seedUsersAndSubreddit();
    const notificationId = await createNotification({
      userId: actorId,
      actorId: authorId,
      kind: "follow",
      title: "A new follower",
    });
    expect(notificationId).toBeTruthy();
    expect((await getUnreadCounts(actorId)).notificationCount).toBe(1);
    await markNotificationsRead({
      userId: actorId,
      ids: [notificationId!],
    });
    expect((await getUnreadCounts(actorId)).notificationCount).toBe(0);
  });
});
