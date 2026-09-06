import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRelation,
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "@/lib/friends";
import {
  blockUser,
  followUser,
  getProfileRelation,
  unblockUser,
} from "@/lib/user-actions";
import { listNotifications } from "@/lib/notifications";

async function seedFriendUsers() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const firstId = `friend_first_${suffix}`;
  const secondId = `friend_second_${suffix}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, status)
       VALUES (?, 'First User', ?, 1, ?, 'active')`
    ).bind(firstId, `${firstId}@test.local`, `first_${suffix}`),
    env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, status)
       VALUES (?, 'Second User', ?, 1, ?, 'active')`
    ).bind(secondId, `${secondId}@test.local`, `second_${suffix}`),
  ]);
  return { firstId, secondId };
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("friend relationships (D1)", () => {
  it("moves from request to friendship and removes on block", async () => {
    const { firstId, secondId } = await seedFriendUsers();

    const sent = await sendFriendRequest(firstId, secondId);
    expect(sent.friendStatus).toBe("outgoing");
    expect(sent.requestId).toBeTruthy();
    expect(await getFriendRelation(secondId, firstId)).toMatchObject({
      status: "incoming",
      requestId: sent.requestId,
    });

    const incoming = await listIncomingFriendRequests(secondId);
    expect(incoming.map((request) => request.id)).toContain(sent.requestId);

    const accepted = await acceptFriendRequest(secondId, sent.requestId!);
    expect(accepted.friendStatus).toBe("friends");
    expect(await getFriendRelation(firstId, secondId)).toMatchObject({
      status: "friends",
      requestId: null,
    });
    expect((await listFriends(firstId)).some((friend) => friend.id === secondId)).toBe(
      true
    );

    await blockUser(firstId, secondId);
    expect(await getFriendRelation(firstId, secondId)).toMatchObject({
      status: "none",
      requestId: null,
    });
    expect((await listFriends(firstId)).some((friend) => friend.id === secondId)).toBe(
      false
    );

    await removeFriend(firstId, secondId);
  });
  it("exposes reverse blocks and never restores social edges", async () => {
    const { firstId, secondId } = await seedFriendUsers();
    await followUser(firstId, secondId);
    const sent = await sendFriendRequest(firstId, secondId);
    await acceptFriendRequest(secondId, sent.requestId!);

    await blockUser(secondId, firstId);
    expect(await getProfileRelation(firstId, secondId)).toMatchObject({
      blockedByMe: false,
      blockedByThem: true,
      blockedEitherDirection: true,
    });
    expect(await getProfileRelation(secondId, firstId)).toMatchObject({
      blockedByMe: true,
      blockedByThem: false,
      blockedEitherDirection: true,
    });
    await expect(followUser(firstId, secondId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(sendFriendRequest(firstId, secondId)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await env.DB.prepare(
        `SELECT 1 FROM user_follows
         WHERE (follower_id = ? AND following_id = ?)
            OR (follower_id = ? AND following_id = ?)`
      )
        .bind(firstId, secondId, secondId, firstId)
        .first()
    ).toBeNull();

    await unblockUser(secondId, firstId);
    expect(await getFriendRelation(firstId, secondId)).toMatchObject({
      status: "none",
    });
    expect(await getProfileRelation(firstId, secondId)).toMatchObject({
      blockedEitherDirection: false,
      following: false,
      friendStatus: "none",
    });
  });

  it("makes duplicate and concurrent follows produce one edge and notification", async () => {
    const { firstId, secondId } = await seedFriendUsers();
    const outcomes = await Promise.all([
      followUser(firstId, secondId),
      followUser(firstId, secondId),
      followUser(firstId, secondId),
    ]);
    expect(outcomes.every((result) => result.following)).toBe(true);
    const edge = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM user_follows
         WHERE follower_id = ? AND following_id = ?`
      )
      .bind(firstId, secondId)
      .first<{ count: number }>();
    expect(Number(edge?.count)).toBe(1);

    await flushBackgroundWork();
    const notifications = await listNotifications(secondId);
    expect(
      notifications.filter((item) => item.kind === "follow")
    ).toHaveLength(1);
  });

  it("makes repeated and concurrent friend accepts idempotent", async () => {
    const { firstId, secondId } = await seedFriendUsers();
    const sent = await sendFriendRequest(firstId, secondId);
    const outcomes = await Promise.all([
      acceptFriendRequest(secondId, sent.requestId!),
      acceptFriendRequest(secondId, sent.requestId!),
      acceptFriendRequest(secondId, sent.requestId!),
    ]);
    expect(outcomes.every((result) => result.friendStatus === "friends")).toBe(
      true
    );
    await flushBackgroundWork();
    const notifications = await listNotifications(firstId);
    expect(
      notifications.filter((item) => item.kind === "friend_accepted")
    ).toHaveLength(1);
  });

  it("never leaves an accepted friendship after concurrent block", async () => {
    const { firstId, secondId } = await seedFriendUsers();
    const sent = await sendFriendRequest(firstId, secondId);
    await Promise.allSettled([
      acceptFriendRequest(secondId, sent.requestId!),
      blockUser(firstId, secondId),
    ]);

    const friendship = await env.DB
      .prepare(
        `SELECT 1 FROM user_friendships
         WHERE pair_key = ? AND status = 'accepted'`
      )
      .bind([firstId, secondId].sort().join(":"))
      .first();
    expect(friendship).toBeNull();
  });
  it("resolves concurrent accept and decline without a pending row", async () => {
    const { firstId, secondId } = await seedFriendUsers();
    const sent = await sendFriendRequest(firstId, secondId);
    await Promise.allSettled([
      acceptFriendRequest(secondId, sent.requestId!),
      declineFriendRequest(secondId, sent.requestId!),
    ]);

    const row = await env.DB
      .prepare(`SELECT status FROM user_friendships WHERE id = ?`)
      .bind(sent.requestId)
      .first<{ status: string }>();
    expect(["accepted", "declined"]).toContain(row?.status);
  });
});
