import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { friendPairKey } from "@/lib/friends";
import { listOnlineUsers } from "@/lib/presence";

async function insertUser(id: string, username: string) {
  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, role, status)
     VALUES (?, ?, ?, 1, ?, 'user', 'active')`
  )
    .bind(id, username, `${id}@presence.test`, username)
    .run();
}

async function insertOnlinePresence(userId: string) {
  await env.DB.prepare(
    `INSERT INTO user_presence (user_id, last_seen_at)
     VALUES (?, datetime('now'))`
  )
    .bind(userId)
    .run();
}

describe("online people relationships (D1)", () => {
  it("excludes users blocked in either direction", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const viewerId = `presence_viewer_${suffix}`;
    const blockedByViewerId = `presence_blocked_by_viewer_${suffix}`;
    const blockedViewerId = `presence_blocked_viewer_${suffix}`;
    const visibleId = `presence_visible_${suffix}`;

    await Promise.all([
      insertUser(viewerId, `presence_viewer_${suffix}`),
      insertUser(blockedByViewerId, `presence_blocked_a_${suffix}`),
      insertUser(blockedViewerId, `presence_blocked_b_${suffix}`),
      insertUser(visibleId, `presence_visible_${suffix}`),
    ]);
    await Promise.all(
      [viewerId, blockedByViewerId, blockedViewerId, visibleId].map(
        insertOnlinePresence
      )
    );
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).bind(viewerId, blockedByViewerId),
      env.DB.prepare(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).bind(blockedViewerId, viewerId),
    ]);

    const users = await listOnlineUsers(viewerId, 30);

    expect(users.map((user) => user.id)).toEqual([visibleId]);
  });

  it("returns follow and friend state with the online users", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const viewerId = `presence_relation_viewer_${suffix}`;
    const followingId = `presence_following_${suffix}`;
    const outgoingId = `presence_outgoing_${suffix}`;
    const incomingId = `presence_incoming_${suffix}`;
    const friendsId = `presence_friends_${suffix}`;
    const unrelatedId = `presence_unrelated_${suffix}`;
    const users = [
      [viewerId, `presence_relation_viewer_${suffix}`],
      [followingId, `presence_following_${suffix}`],
      [outgoingId, `presence_outgoing_${suffix}`],
      [incomingId, `presence_incoming_${suffix}`],
      [friendsId, `presence_friends_${suffix}`],
      [unrelatedId, `presence_unrelated_${suffix}`],
    ] as const;

    await Promise.all(users.map(([id, username]) => insertUser(id, username)));
    await Promise.all(users.map(([id]) => insertOnlinePresence(id)));
    const outgoingRequestId = `presence_outgoing_request_${suffix}`;
    const incomingRequestId = `presence_incoming_request_${suffix}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)`
      ).bind(viewerId, followingId),
      env.DB.prepare(
        `INSERT INTO user_friendships (
           id, pair_key, requester_id, addressee_id, status
         ) VALUES (?, ?, ?, ?, 'pending')`
      ).bind(
        outgoingRequestId,
        friendPairKey(viewerId, outgoingId),
        viewerId,
        outgoingId
      ),
      env.DB.prepare(
        `INSERT INTO user_friendships (
           id, pair_key, requester_id, addressee_id, status
         ) VALUES (?, ?, ?, ?, 'pending')`
      ).bind(
        incomingRequestId,
        friendPairKey(viewerId, incomingId),
        incomingId,
        viewerId
      ),
      env.DB.prepare(
        `INSERT INTO user_friendships (
           id, pair_key, requester_id, addressee_id, status
         ) VALUES (?, ?, ?, ?, 'accepted')`
      ).bind(
        `presence_friends_request_${suffix}`,
        friendPairKey(viewerId, friendsId),
        viewerId,
        friendsId
      ),
    ]);

    const online = await listOnlineUsers(viewerId, 30);
    const byId = new Map(online.map((user) => [user.id, user]));

    expect(byId.get(followingId)).toMatchObject({
      following: true,
      friendStatus: "none",
      friendRequestId: null,
    });
    expect(byId.get(outgoingId)).toMatchObject({
      following: false,
      friendStatus: "outgoing",
      friendRequestId: outgoingRequestId,
    });
    expect(byId.get(incomingId)).toMatchObject({
      following: false,
      friendStatus: "incoming",
      friendRequestId: incomingRequestId,
    });
    expect(byId.get(friendsId)).toMatchObject({
      following: false,
      friendStatus: "friends",
      friendRequestId: null,
    });
    expect(byId.get(unrelatedId)).toMatchObject({
      following: false,
      friendStatus: "none",
      friendRequestId: null,
    });
  });
});
