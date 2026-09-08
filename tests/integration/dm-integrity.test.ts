import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  cancelChatRequest,
  listChatRooms,
  listIncomingRequests,
  listOutgoingRequests,
  respondToChatRequest,
  sendChatMessage,
  startConversation,
} from "@/lib/messages";
import { getUnreadCounts, refreshUnreadCounts } from "@/lib/unread";
import { setSiteSetting } from "@/lib/settings";
import { blockUser, getProfileRelation, unblockUser } from "@/lib/user-actions";

async function insertUser(id: string, username = id) {
  await env.DB
    .prepare(
      `INSERT INTO "user" (
         id, name, email, emailVerified, username, karma, allowDms, role, status
       ) VALUES (?, ?, ?, 1, ?, 0, 'anyone', 'user', 'active')`
    )
    .bind(id, username, `${id}@test.local`, username)
    .run();
}

async function start(
  senderId: string,
  recipientUsername: string,
  body: string,
  requestId = crypto.randomUUID()
) {
  return startConversation({
    fromUserId: senderId,
    toUsername: recipientUsername,
    openerBody: body,
    fromStatus: "active",
    clientMessageId: requestId,
  });
}

async function seedPair(label: string) {
  const senderId = `integrity_sender_${label}`;
  const recipientId = `integrity_recipient_${label}`;
  const senderUsername = senderId;
  const recipientUsername = recipientId;
  await Promise.all([
    insertUser(senderId, senderUsername),
    insertUser(recipientId, recipientUsername),
  ]);
  return { senderId, recipientId, senderUsername, recipientUsername };
}

async function allowMultipleRequests() {
  await setSiteSetting("max_dm_requests_burst_per_min", "10");
  await setSiteSetting("max_dm_requests_per_hour", "50");
}

describe("DM integrity invariants (D1)", () => {
  it("discards a declined opener before a later request is accepted", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const declined = await start(
      pair.senderId,
      pair.recipientUsername,
      "Declined opener"
    );
    await respondToChatRequest({
      requestId: declined.requestId!,
      userId: pair.recipientId,
      accept: false,
    });

    const replacement = await start(
      pair.senderId,
      pair.recipientUsername,
      "Replacement opener"
    );
    await respondToChatRequest({
      requestId: replacement.requestId!,
      userId: pair.recipientId,
      accept: true,
    });

    const messages = await env.DB
      .prepare(
        `SELECT body, delivery_status
         FROM chat_messages
         WHERE room_id = ? AND sender_id = ?
         ORDER BY created_at ASC, id ASC`
      )
      .bind(replacement.roomId, pair.senderId)
      .all<{ body: string; delivery_status: string }>();
    expect(messages.results).toEqual([
      { body: "Replacement opener", delivery_status: "delivered" },
    ]);
  });

  it("repairs an accepted request whose membership/message batch was incomplete", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Repair this accepted request"
    );
    await env.DB.batch([
      env.DB
        .prepare(`UPDATE chat_requests SET status = 'accepted' WHERE id = ?`)
        .bind(request.requestId),
      env.DB
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'pending', joined_at = NULL
           WHERE room_id = ?`
        )
        .bind(request.roomId),
    ]);

    await respondToChatRequest({
      requestId: request.requestId!,
      userId: pair.recipientId,
      accept: true,
    });
    const members = await env.DB
      .prepare(
        `SELECT membership_status FROM chat_room_members
         WHERE room_id = ? ORDER BY user_id`
      )
      .bind(request.roomId)
      .all<{ membership_status: string }>();
    const message = await env.DB
      .prepare(
        `SELECT delivery_status FROM chat_messages
         WHERE room_id = ?
         ORDER BY created_at ASC, id ASC
         LIMIT 1`
      )
      .bind(request.roomId)
      .first<{ delivery_status: string }>();
    expect(members.results?.every((row) => row.membership_status === "active")).toBe(
      true
    );
    expect(message?.delivery_status).toBe("delivered");
  });

  it("keeps opposite concurrent requests to one pending request per room", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const opposite = await Promise.allSettled([
      start(
        pair.senderId,
        pair.recipientUsername,
        "A to B",
        crypto.randomUUID()
      ),
      start(
        pair.recipientId,
        pair.senderUsername,
        "B to A",
        crypto.randomUUID()
      ),
    ]);

    expect(opposite.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = opposite.find((result) => result.status === "rejected");
    expect((failure as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    const pending = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chat_requests r
         INNER JOIN chat_rooms room ON room.id = r.room_id
         WHERE room.pair_key = ? AND r.status = 'pending'`
      )
      .bind([pair.senderId, pair.recipientId].sort().join(":"))
      .first<{ count: number }>();
    expect(Number(pending?.count)).toBe(1);
  });

  it("cancels outgoing requests and removes their pending opener", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Cancel me"
    );
    expect(await listOutgoingRequests(pair.senderId)).toHaveLength(1);

    await cancelChatRequest({
      requestId: request.requestId!,
      userId: pair.senderId,
    });
    const status = await env.DB
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.requestId)
      .first<{ status: string }>();
    const pending = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM chat_messages
         WHERE room_id = ? AND delivery_status = 'pending'`
      )
      .bind(request.roomId)
      .first<{ count: number }>();
    expect(status?.status).toBe("cancelled");
    expect(Number(pending?.count)).toBe(0);
    expect(await listOutgoingRequests(pair.senderId)).toHaveLength(0);
  });

  it("reconciles unread counts and revokes direct access when blocking", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Unread opener"
    );
    await respondToChatRequest({
      requestId: request.requestId!,
      userId: pair.recipientId,
      accept: true,
    });
    await sendChatMessage({
      roomId: request.roomId,
      userId: pair.senderId,
      body: "Unread direct message",
    });
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBeGreaterThan(0);

    await blockUser(pair.recipientId, pair.senderId);
    await refreshUnreadCounts(pair.recipientId);
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBe(0);
    expect(await listChatRooms(pair.recipientId)).toHaveLength(0);
    expect(
      await env.DB
        .prepare(
          `SELECT COUNT(*) AS count FROM chat_room_members
           WHERE room_id = ? AND membership_status = 'active'`
        )
        .bind(request.roomId)
        .first<{ count: number }>()
    ).toEqual({ count: 0 });
    await expect(
      sendChatMessage({
        roomId: request.roomId,
        userId: pair.senderId,
        body: "Blocked race write",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "You can't message this user",
    });
  });

  it("does not resurrect a revoked room after unblock", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Before block"
    );
    await blockUser(pair.recipientId, pair.senderId);
    await unblockUser(pair.recipientId, pair.senderId);

    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);
    const replacement = await start(
      pair.senderId,
      pair.recipientUsername,
      "After unblock"
    );
    expect(replacement.conversationType).toBe("request");
    expect(replacement.requestId).not.toBe(request.requestId);
    expect(await listOutgoingRequests(pair.senderId)).toHaveLength(1);

    const relation = await getProfileRelation(pair.senderId, pair.recipientId);
    expect(relation.blockedEitherDirection).toBe(false);
  });
});
