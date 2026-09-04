import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  acceptFriendRequest,
  getFriendRelation,
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "@/lib/friends";
import { blockUser } from "@/lib/user-actions";

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
});
