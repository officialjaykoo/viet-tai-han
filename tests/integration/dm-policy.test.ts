import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createComment, createPost, createSubreddit } from "@/lib/actions";
import { getDmRelationship } from "@/lib/dm-relationships";
import {
  cancelChatRequest,
  getChatMessages,
  listChatRooms,
  listIncomingRequests,
  respondToChatRequest,
  sendChatMessage,
  startConversation,
} from "@/lib/messages";
import { setSiteSetting } from "@/lib/settings";
import {
  blockUser,
  followUser,
  getProfileRelation,
  unblockUser,
  unfollowUser,
} from "@/lib/user-actions";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "@/lib/friends";
import {
  canNotifyChat,
  createNotification,
  listNotifications,
} from "@/lib/notifications";
import { likePost } from "@/lib/likes";
import { getUnreadCounts } from "@/lib/unread";

async function insertUser(
  id: string,
  username: string,
  options: {
    karma?: number;
    allowDms?: "anyone" | "followers" | "nobody";
    role?: "user" | "admin";
  } = {}
) {
  await env.DB
    .prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, allowDms, role, status)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')`
    )
    .bind(
      id,
      username,
      `${id}@test.local`,
      username,
      options.karma ?? 0,
      options.allowDms ?? "anyone",
      options.role ?? "user"
    )
    .run();
}

function ids(suffix: string, index: number) {
  return {
    senderId: `dm_${suffix}_sender_${index}`,
    recipientId: `dm_${suffix}_recipient_${index}`,
    senderUsername: `dm_${suffix}_sender_${index}`,
    recipientUsername: `dm_${suffix}_recipient_${index}`,
  };
}

async function start(senderId: string, recipientUsername: string, body = "Hello") {
  return startConversation({
    fromUserId: senderId,
    toUsername: recipientUsername,
    openerBody: body,
    fromStatus: "active",
  });
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("DM relationship policy (D1)", () => {
  it("allows a karma-zero user to create a request without a karma gate", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_zero_sender_${suffix}`;
    const recipientId = `dm_zero_recipient_${suffix}`;
    const recipientUsername = `dm_zero_recipient_${suffix}`;
    await Promise.all([
      insertUser(senderId, `dm_zero_sender_${suffix}`),
      insertUser(recipientId, recipientUsername),
    ]);

    const request = await start(senderId, recipientUsername, "Hello from zero karma.");
    expect(request.conversationType).toBe("request");
    expect(request.requestId).toBeTruthy();

    const message = await env.DB
      .prepare(
        `SELECT delivery_status FROM chat_messages WHERE room_id = ? AND sender_id = ?`
      )
      .bind(request.roomId, senderId)
      .first<{ delivery_status: string }>();
    expect(message?.delivery_status).toBe("pending");
  });

  it("returns the same chat request after a retried start", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_retry_sender_${suffix}`;
    const recipientId = `dm_retry_recipient_${suffix}`;
    const recipientUsername = `dm_retry_recipient_${suffix}`;
    await Promise.all([
      insertUser(senderId, `dm_retry_sender_${suffix}`),
      insertUser(recipientId, recipientUsername),
    ]);

    const requestId = crypto.randomUUID();
    const first = await startConversation({
      fromUserId: senderId,
      toUsername: recipientUsername,
      openerBody: "Retry-safe opener.",
      fromStatus: "active",
      requestId,
    });
    const retried = await startConversation({
      fromUserId: senderId,
      toUsername: recipientUsername,
      openerBody: "Retry-safe opener.",
      fromStatus: "active",
      requestId,
    });

    expect(first).toMatchObject({
      conversationType: "request",
      created: true,
      roomId: expect.any(String),
    });
    expect(retried).toMatchObject({
      conversationType: "request",
      created: false,
      roomId: first.roomId,
      requestId: first.requestId,
    });

    const requestCount = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM chat_requests
         WHERE from_user_id = ? AND request_id = ?`
      )
      .bind(senderId, requestId)
      .first<{ count: number }>();
    expect(Number(requestCount?.count)).toBe(1);
    await flushBackgroundWork();
    const notifications = await listNotifications(recipientId);
    expect(
      notifications.filter((notification) => notification.kind === "chat_request")
    ).toHaveLength(1);
  });

  it("reads only the cancelled chat request notification in a request race", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    await setSiteSetting("max_dm_requests_burst_per_min", "10");
    await setSiteSetting("max_dm_requests_per_hour", "50");
    const senderId = `dm_notify_race_sender_${suffix}`;
    const recipientId = `dm_notify_race_recipient_${suffix}`;
    await Promise.all([
      insertUser(senderId, senderId),
      insertUser(recipientId, recipientId),
    ]);

    const first = await start(senderId, recipientId, "R1 request");
    await flushBackgroundWork();
    const firstNotification = await env.DB
      .prepare(
        `SELECT source_request_id, is_read
         FROM notifications
         WHERE user_id = ? AND kind = 'chat_request' AND source_request_id = ?`
      )
      .bind(recipientId, first.requestId)
      .first<{ source_request_id: string; is_read: number }>();
    expect(firstNotification?.is_read).toBe(0);

    const [, second] = await Promise.all([
      cancelChatRequest({
        requestId: first.requestId!,
        userId: senderId,
      }),
      start(senderId, recipientId, "R2 request"),
    ]);
    await flushBackgroundWork();

    const notifications = await env.DB
      .prepare(
        `SELECT source_request_id, is_read
         FROM notifications
         WHERE user_id = ? AND kind = 'chat_request'
           AND source_request_id IN (?, ?)
         ORDER BY source_request_id`
      )
      .bind(recipientId, first.requestId, second.requestId)
      .all<{ source_request_id: string; is_read: number }>();
    expect(
      notifications.results?.find(
        (notification) => notification.source_request_id === first.requestId
      )?.is_read
    ).toBe(1);
    expect(
      notifications.results?.find(
        (notification) => notification.source_request_id === second.requestId
      )?.is_read
    ).toBe(0);
    expect((await getUnreadCounts(recipientId)).notificationCount).toBe(1);
  });
  it("drops a delayed chat request notification after cancellation", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_delayed_sender_${suffix}`;
    const recipientId = `dm_delayed_recipient_${suffix}`;
    await Promise.all([
      insertUser(senderId, senderId),
      insertUser(recipientId, recipientId),
    ]);

    const request = await start(senderId, recipientId, "Delayed request");
    await cancelChatRequest({
      requestId: request.requestId!,
      userId: senderId,
    });
    const before = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE user_id = ? AND kind = 'chat_request'
           AND actor_id = ?`
      )
      .bind(recipientId, senderId)
      .first<{ count: number }>();

    await expect(
      createNotification({
        userId: recipientId,
        actorId: senderId,
        kind: "chat_request",
        sourceRequestId: request.requestId!,
        title: "Delayed chat request",
      })
    ).resolves.toBeNull();
    const after = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE user_id = ? AND kind = 'chat_request'
           AND actor_id = ?`
      )
      .bind(recipientId, senderId)
      .first<{ count: number }>();

    expect(Number(after?.count ?? 0)).toBe(Number(before?.count ?? 0));
    expect((await getUnreadCounts(recipientId)).notificationCount).toBe(0);
  });

  it("keeps the second chat notification unread after the first is cancelled", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const recipientId = `dm_fanout_recipient_${suffix}`;
    const senderOneId = `dm_fanout_sender_one_${suffix}`;
    const senderTwoId = `dm_fanout_sender_two_${suffix}`;
    await setSiteSetting("max_dm_requests_burst_per_min", "10");
    await setSiteSetting("max_dm_requests_per_hour", "50");
    await Promise.all([
      insertUser(senderOneId, senderOneId),
      insertUser(senderTwoId, senderTwoId),
      insertUser(recipientId, recipientId),
    ]);

    const first = await start(senderOneId, recipientId, "First request");
    const second = await start(senderTwoId, recipientId, "Second request");
    await flushBackgroundWork();
    expect((await getUnreadCounts(recipientId)).notificationCount).toBe(2);

    await cancelChatRequest({
      requestId: first.requestId!,
      userId: senderOneId,
    });
    const notifications = await env.DB
      .prepare(
        `SELECT source_request_id, is_read
         FROM notifications
         WHERE user_id = ? AND kind = 'chat_request'
           AND source_request_id IN (?, ?)
         ORDER BY source_request_id`
      )
      .bind(recipientId, first.requestId, second.requestId)
      .all<{ source_request_id: string; is_read: number }>();
    expect(notifications.results).toEqual(
      expect.arrayContaining([
        { source_request_id: first.requestId, is_read: 1 },
        { source_request_id: second.requestId, is_read: 0 },
      ])
    );

    const canonical = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE user_id = ? AND is_read = 0`
      )
      .bind(recipientId)
      .first<{ count: number }>();
    const fanout = await env.DB
      .prepare(
        `SELECT notification_count
         FROM unread_fanout
         WHERE user_id = ?`
      )
      .bind(recipientId)
      .first<{ notification_count: number }>();
    expect(Number(canonical?.count ?? 0)).toBe(1);
    expect(Number(fanout?.notification_count ?? 0)).toBe(
      Number(canonical?.count ?? 0)
    );
    expect((await getUnreadCounts(recipientId)).notificationCount).toBe(1);
  });


  it("uses opposite follow directions for direct access and request privacy", async () => {
    const cases: Array<{
      allowDms: "anyone" | "followers" | "nobody";
      senderFollowsRecipient?: boolean;
      recipientFollowsSender?: boolean;
      friends?: boolean;
      expected: "direct" | "request" | "reject";
    }> = [
      { allowDms: "anyone", expected: "request" },
      {
        allowDms: "followers",
        senderFollowsRecipient: true,
        expected: "request",
      },
      {
        allowDms: "followers",
        recipientFollowsSender: true,
        expected: "direct",
      },
      {
        allowDms: "followers",
        senderFollowsRecipient: true,
        recipientFollowsSender: true,
        expected: "direct",
      },
      { allowDms: "followers", expected: "reject" },
      { allowDms: "nobody", expected: "reject" },
      {
        allowDms: "nobody",
        senderFollowsRecipient: true,
        expected: "reject",
      },
      {
        allowDms: "nobody",
        recipientFollowsSender: true,
        expected: "direct",
      },
      { allowDms: "nobody", friends: true, expected: "direct" },
    ];

    for (const [index, policy] of cases.entries()) {
      const pair = ids("matrix", index);
      await Promise.all([
        insertUser(pair.senderId, pair.senderUsername),
        insertUser(pair.recipientId, pair.recipientUsername, {
          allowDms: policy.allowDms,
        }),
      ]);

      if (policy.senderFollowsRecipient) {
        await followUser(pair.senderId, pair.recipientId);
      }
      if (policy.recipientFollowsSender) {
        await followUser(pair.recipientId, pair.senderId);
      }
      if (policy.friends) {
        const friendRequest = await sendFriendRequest(
          pair.senderId,
          pair.recipientId
        );
        await acceptFriendRequest(pair.recipientId, friendRequest.requestId!);
      }

      const relationship = await getDmRelationship({
        senderId: pair.senderId,
        recipientId: pair.recipientId,
      });
      expect(relationship.senderFollowsRecipient).toBe(
        Boolean(policy.senderFollowsRecipient)
      );
      expect(relationship.recipientFollowsSender).toBe(
        Boolean(policy.recipientFollowsSender)
      );
      expect(relationship.friends).toBe(Boolean(policy.friends));

      if (policy.expected === "reject") {
        await expect(start(pair.senderId, pair.recipientUsername)).rejects.toMatchObject({
          status: 403,
          message: "This user isn't accepting chat requests",
        });
      } else {
        const result = await start(pair.senderId, pair.recipientUsername);
        expect(result.conversationType).toBe(policy.expected);
      }
    }
  });

  it("promotes pending requests, reuses rooms, survives unfollow, and blocks writes", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const pair = ids(`transition_${suffix}`, 0);
    await Promise.all([
      insertUser(pair.senderId, pair.senderUsername),
      insertUser(pair.recipientId, pair.recipientUsername),
    ]);

    const request = await start(pair.senderId, pair.recipientUsername, "Pending opener");
    expect(request.conversationType).toBe("request");
    expect(request.requestId).toBeTruthy();

    await followUser(pair.recipientId, pair.senderId);
    await flushBackgroundWork();
    const followNotifications = await listNotifications(pair.senderId);
    expect(
      followNotifications.some(
        (notification) =>
          notification.kind === "chat_accepted" &&
          notification.title.includes("You can now message @")
      )
    ).toBe(true);

    const accepted = await env.DB
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.requestId)
      .first<{ status: string }>();
    expect(accepted?.status).toBe("accepted");

    const memberships = await env.DB
      .prepare(
        `SELECT user_id, membership_status
         FROM chat_room_members WHERE room_id = ? ORDER BY user_id`
      )
      .bind(request.roomId)
      .all<{ user_id: string; membership_status: string }>();
    expect(memberships.results?.every((row) => row.membership_status === "active")).toBe(
      true
    );
    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);

    const direct = await start(pair.senderId, pair.recipientUsername, "After follow");
    expect(direct.conversationType).toBe("direct");
    expect(direct.roomId).toBe(request.roomId);

    const messageRequestId = crypto.randomUUID();
    const firstMessage = await sendChatMessage({
      roomId: request.roomId,
      userId: pair.senderId,
      body: "Retry-safe direct message.",
      requestId: messageRequestId,
    });
    const retriedMessage = await sendChatMessage({
      roomId: request.roomId,
      userId: pair.senderId,
      body: "Retry-safe direct message.",
      requestId: messageRequestId,
    });
    expect(firstMessage.created).toBe(true);
    expect(retriedMessage).toMatchObject({
      id: firstMessage.id,
      created: false,
    });
    const messageCount = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM chat_messages
         WHERE sender_id = ? AND request_id = ?`
      )
      .bind(pair.senderId, messageRequestId)
      .first<{ count: number }>();
    expect(Number(messageCount?.count)).toBe(1);

    await unfollowUser(pair.recipientId, pair.senderId);
    await env.DB
      .prepare(`UPDATE "user" SET allowDms = 'nobody' WHERE id = ?`)
      .bind(pair.recipientId)
      .run();
    await expect(
      getProfileRelation(pair.senderId, pair.recipientId)
    ).resolves.toMatchObject({
      canMessage: true,
    });

    const afterUnfollow = await start(
      pair.senderId,
      pair.recipientUsername,
      "Existing room remains open"
    );
    expect(afterUnfollow.conversationType).toBe("direct");
    expect(afterUnfollow.roomId).toBe(request.roomId);

    const listedBeforeBlock = await listChatRooms(pair.senderId);
    expect(listedBeforeBlock.some((room) => room.id === request.roomId)).toBe(true);

    await blockUser(pair.recipientId, pair.senderId);
    await expect(
      sendChatMessage({
        roomId: request.roomId,
        userId: pair.senderId,
        body: "Blocked after room activation",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "You can't message this user",
    });
    await expect(
      start(pair.senderId, pair.recipientUsername, "Blocked new start")
    ).rejects.toMatchObject({
      status: 403,
      message: "You can't message this user",
    });

    const roomMemberships = await env.DB
      .prepare(
        `SELECT
           SUM(CASE WHEN membership_status = 'active' THEN 1 ELSE 0 END) AS active_count,
           SUM(CASE WHEN membership_status = 'left' THEN 1 ELSE 0 END) AS left_count
         FROM chat_room_members
         WHERE room_id = ?`
      )
      .bind(request.roomId)
      .first<{ active_count: number; left_count: number }>();
    expect(Number(roomMemberships?.active_count)).toBe(0);
    expect(Number(roomMemberships?.left_count)).toBe(2);
  });
  it("blocks history while revoked and preserves delivered history after unblock", async () => {
    const pair = ids("history-policy", 0);
    await Promise.all([
      insertUser(pair.senderId, pair.senderUsername),
      insertUser(pair.recipientId, pair.recipientUsername),
    ]);
    await followUser(pair.recipientId, pair.senderId);

    const first = await start(
      pair.senderId,
      pair.recipientUsername,
      "History before block"
    );
    expect(first.conversationType).toBe("direct");
    await expect(
      getChatMessages({ roomId: first.roomId, userId: pair.recipientId })
    ).resolves.toMatchObject({
      messages: [expect.objectContaining({ body: "History before block" })],
    });

    await blockUser(pair.recipientId, pair.senderId);
    await expect(
      getChatMessages({ roomId: first.roomId, userId: pair.recipientId })
    ).rejects.toMatchObject({ status: 404 });

    await unblockUser(pair.recipientId, pair.senderId);
    await followUser(pair.recipientId, pair.senderId);
    const reopened = await start(
      pair.senderId,
      pair.recipientUsername,
      "History after unblock"
    );
    expect(reopened.roomId).toBe(first.roomId);
    const history = await getChatMessages({
      roomId: first.roomId,
      userId: pair.recipientId,
    });
    expect(history.messages.map((message) => message.body)).toEqual([
      "History before block",
      "History after unblock",
    ]);
  });

  it("uses the automatic message for friendship promotion", async () => {
    const pair = ids("friend-promotion", 0);
    await Promise.all([
      insertUser(pair.senderId, pair.senderUsername),
      insertUser(pair.recipientId, pair.recipientUsername),
    ]);
    const request = await start(pair.senderId, pair.recipientUsername);
    const friendRequest = await sendFriendRequest(
      pair.senderId,
      pair.recipientId
    );
    await acceptFriendRequest(pair.recipientId, friendRequest.requestId!);

    await flushBackgroundWork();
    const notifications = await listNotifications(pair.senderId);
    expect(
      notifications.some(
        (notification) =>
          notification.kind === "chat_accepted" &&
          notification.title ===
            `You can now message @${pair.recipientUsername} directly`
      )
    ).toBe(true);
    expect(
      await env.DB.prepare(
        `SELECT status FROM chat_requests WHERE id = ?`
      )
        .bind(request.requestId)
        .first<{ status: string }>()
    ).toEqual({ status: "accepted" });
  });
  it("cancels and hides pending requests after a block", async () => {
    const pair = ids("blocked-request", 0);
    await Promise.all([
      insertUser(pair.senderId, pair.senderUsername),
      insertUser(pair.recipientId, pair.recipientUsername),
    ]);

    const request = await start(pair.senderId, pair.recipientUsername);
    expect(request.requestId).toBeTruthy();
    await blockUser(pair.recipientId, pair.senderId);

    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);
    const cancelled = await env.DB
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.requestId)
      .first<{ status: string }>();
    expect(cancelled?.status).toBe("cancelled");
    const pendingOpener = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chat_messages
         WHERE room_id = ? AND sender_id = ? AND delivery_status = 'pending'`
      )
      .bind(request.roomId, pair.senderId)
      .first<{ count: number }>();
    expect(Number(pendingOpener?.count)).toBe(0);
    await expect(
      respondToChatRequest({
        requestId: request.requestId!,
        userId: pair.recipientId,
        accept: true,
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "Request already handled",
    });
  });

  it("retains request rate limits for karma-zero users", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_rate_sender_${suffix}`;
    const firstUsername = `dm_rate_first_${suffix}`;
    const secondUsername = `dm_rate_second_${suffix}`;
    await Promise.all([
      insertUser(senderId, senderId),
      insertUser(`dm_rate_first_${suffix}`, firstUsername),
      insertUser(`dm_rate_second_${suffix}`, secondUsername),
    ]);
    await setSiteSetting("max_dm_requests_per_hour", "1");
    await setSiteSetting("max_dm_requests_burst_per_min", "10");

    await start(senderId, firstUsername, "First request");
    await expect(start(senderId, secondUsername, "Second request")).rejects.toMatchObject({
      status: 429,
      message: "You're doing that too often. Try again later.",
    });
  });

  it("allows zero and negative reputation users to use normal content actions", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const adminId = `admin_${suffix}`;
    const creatorId = `normal_negative_creator_${suffix}`;
    const actorId = `normal_zero_actor_${suffix}`;
    await Promise.all([
      insertUser(adminId, `admin_${suffix}`, { role: "admin" }),
      insertUser(creatorId, `normal_negative_creator_${suffix}`, { karma: -25 }),
      insertUser(actorId, `normal_zero_actor_${suffix}`, { karma: 0 }),
    ]);

    const community = await createSubreddit({
      actor: { id: adminId, role: "admin", status: "active" },
      name: `normal_${suffix}`,
      title: "Admin-created community",
    });
    const post = await createPost({
      userId: creatorId,
      subredditId: community.id,
      title: "Normal users can create posts",
      body: "Negative reputation does not block creation.",
    });
    const comment = await createComment({
      userId: actorId,
      postId: post.id,
      body: "Zero reputation can comment.",
    });
    expect(comment.id).toBeTruthy();

    const liked = await likePost(post.id, actorId);
    expect(liked.liked).toBe(true);
  });
  it("suppresses delayed actor notifications after a block", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const actorId = `notify_actor_${suffix}`;
    const recipientId = `notify_recipient_${suffix}`;
    await Promise.all([
      insertUser(actorId, actorId),
      insertUser(recipientId, recipientId),
    ]);
    await blockUser(recipientId, actorId);

    expect(await canNotifyChat(recipientId, actorId)).toBe(false);
    const kinds = [
      "follow",
      "friend_request",
      "friend_accepted",
      "chat_request",
      "chat_accepted",
    ] as const;
    for (const kind of kinds) {
      await expect(
        createNotification({
          userId: recipientId,
          actorId,
          kind,
          title: `Delayed ${kind}`,
        })
      ).resolves.toBeNull();
    }

    const notifications = await listNotifications(recipientId);
    expect(
      notifications.filter((notification) => notification.actor?.username === actorId)
    ).toHaveLength(0);
    expect((await getUnreadCounts(recipientId)).notificationCount).toBe(0);
  });
});
