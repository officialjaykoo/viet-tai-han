import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  createNotification,
  markNotificationsRead,
} from "@/lib/notifications";
import {
  getChatMessages,
  listChatRooms,
  respondToChatRequest,
  startChatRequest,
  sendChatMessage,
  listIncomingRequests,
} from "@/lib/messages";
import {
  listChatMessageReports,
  reportChatMessage,
  reviewChatMessageReport,
} from "@/lib/dm-moderation";
import { AuthError } from "@/lib/session";
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

describe("messaging delivery (D1)", () => {
  it("fans out unread counts, marks messages read, and moderates reports", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    const voterUsername = await usernameFor(voterId);
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: voterUsername,
      openerBody: "Hello from the delivery test.",
      fromStatus: "active",
    });

    expect((await listIncomingRequests(voterId)).some((item) => item.id === request.requestId)).toBe(
      true
    );
    await respondToChatRequest({
      requestId: request.requestId,
      userId: voterId,
      accept: true,
    });
    await getChatMessages({ roomId: request.roomId, userId: voterId });

    const sent = await sendChatMessage({
      roomId: request.roomId,
      userId: authorId,
      body: "Please review this message.",
      userStatus: "active",
    });
    expect((await getUnreadCounts(voterId)).messageCount).toBe(1);
    expect((await listChatRooms(voterId))[0]?.unreadCount).toBe(1);

    const visible = await getChatMessages({
      roomId: request.roomId,
      userId: voterId,
    });
    expect(visible.some((message) => message.id === sent.id)).toBe(true);
    expect((await getUnreadCounts(voterId)).messageCount).toBe(0);

    await reportChatMessage({
      roomId: request.roomId,
      messageId: sent.id,
      reporterId: voterId,
      reason: "harassment",
      details: "Test moderation report",
    });
    await expect(
      reportChatMessage({
        roomId: request.roomId,
        messageId: sent.id,
        reporterId: voterId,
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
      (await getChatMessages({ roomId: request.roomId, userId: voterId })).some(
        (message) => message.id === sent.id
      )
    ).toBe(false);
  });

  it("allows only one concurrent request response", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: await usernameFor(voterId),
      openerBody: "Accept this exactly once.",
      fromStatus: "active",
    });
    const outcomes = await Promise.allSettled([
      respondToChatRequest({
        requestId: request.requestId,
        userId: voterId,
        accept: true,
      }),
      respondToChatRequest({
        requestId: request.requestId,
        userId: voterId,
        accept: true,
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(AuthError);
    expect(
      await env.DB
        .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
        .bind(request.requestId)
        .first<{ status: string }>()
    ).toEqual({ status: "accepted" });
  });

  it("keeps notification fanout in sync when notifications are read", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    const notificationId = await createNotification({
      userId: voterId,
      actorId: authorId,
      kind: "follow",
      title: "A new follower",
    });
    expect(notificationId).toBeTruthy();
    expect((await getUnreadCounts(voterId)).notificationCount).toBe(1);
    await markNotificationsRead({
      userId: voterId,
      ids: [notificationId!],
    });
    expect((await getUnreadCounts(voterId)).notificationCount).toBe(0);
  });
});
