import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createComment, createPost, createSubreddit } from "@/lib/actions";
import { getDmRelationship } from "@/lib/dm-relationships";
import {
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
  unfollowUser,
} from "@/lib/user-actions";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "@/lib/friends";
import { listNotifications } from "@/lib/notifications";
import { voteOnPost } from "@/lib/votes";

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

    await unfollowUser(pair.recipientId, pair.senderId);
    await env.DB
      .prepare(`UPDATE "user" SET allowDms = 'nobody' WHERE id = ?`)
      .bind(pair.recipientId)
      .run();

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

    const roomStillActive = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chat_room_members
         WHERE room_id = ? AND membership_status = 'active'`
      )
      .bind(request.roomId)
      .first<{ count: number }>();
    expect(Number(roomStillActive?.count)).toBe(2);
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
  it("hides and rejects pending requests after a block", async () => {
    const pair = ids("blocked-request", 0);
    await Promise.all([
      insertUser(pair.senderId, pair.senderUsername),
      insertUser(pair.recipientId, pair.recipientUsername),
    ]);

    const request = await start(pair.senderId, pair.recipientUsername);
    expect(request.requestId).toBeTruthy();
    await blockUser(pair.recipientId, pair.senderId);

    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);
    await expect(
      respondToChatRequest({
        requestId: request.requestId!,
        userId: pair.recipientId,
        accept: true,
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "You can't message this user",
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
    const voterId = `normal_zero_voter_${suffix}`;
    await Promise.all([
      insertUser(adminId, `admin_${suffix}`, { role: "admin" }),
      insertUser(creatorId, `normal_negative_creator_${suffix}`, { karma: -25 }),
      insertUser(voterId, `normal_zero_voter_${suffix}`, { karma: 0 }),
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
      userId: voterId,
      postId: post.id,
      body: "Zero reputation can comment.",
    });
    expect(comment.id).toBeTruthy();

    const vote = await voteOnPost(post.id, "upvote", {
      userId: voterId,
      voterKarma: 0,
    });
    expect(vote.viewerVote).toBe("upvote");
  });
});
