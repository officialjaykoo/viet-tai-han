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

async function allowDirectAccess(senderId: string, recipientId: string) {
  await env.DB.batch([
    env.DB
      .prepare(`UPDATE "user" SET allowDms = 'followers' WHERE id = ?`)
      .bind(recipientId),
    env.DB
      .prepare(
        `INSERT OR IGNORE INTO user_follows (follower_id, following_id)
         VALUES (?, ?)`
      )
      .bind(recipientId, senderId),
  ]);
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

    expect((await getProfileRelation(pair.senderId, pair.recipientId)).blockState).toBe(
      "none"
    );
  });
  it("closes a direct room when creation races with a block", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    await allowDirectAccess(pair.senderId, pair.recipientId);

    const outcomes = await Promise.allSettled([
      start(pair.senderId, pair.recipientUsername, "Direct race"),
      blockUser(pair.recipientId, pair.senderId),
    ]);
    expect(outcomes[1]?.status).toBe("fulfilled");

    const active = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chat_room_members m
         INNER JOIN chat_rooms r ON r.id = m.room_id
         WHERE r.pair_key = ? AND m.membership_status = 'active'`
      )
      .bind([pair.senderId, pair.recipientId].sort().join(":"))
      .first<{ count: number }>();
    expect(Number(active?.count)).toBe(0);
  });

  it("leaves no active, delivered, or pending rows when block commits first", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Block-first request"
    );
    await blockUser(pair.recipientId, pair.senderId);

    await expect(
      start(pair.senderId, pair.recipientUsername, "After committed block")
    ).rejects.toMatchObject({ status: 403 });

    const state = await env.DB
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM chat_room_members
            WHERE room_id = ? AND membership_status = 'active') AS active_count,
           (SELECT COUNT(*) FROM chat_messages
            WHERE room_id = ? AND delivery_status = 'delivered') AS delivered_count,
           (SELECT COUNT(*) FROM chat_messages
            WHERE room_id = ? AND delivery_status = 'pending') AS pending_count`
      )
      .bind(request.roomId, request.roomId, request.roomId)
      .first<{
        active_count: number;
        delivered_count: number;
        pending_count: number;
      }>();
    expect(state).toEqual({
      active_count: 0,
      delivered_count: 0,
      pending_count: 0,
    });
  });

  it("keeps existing-room activation closed when it races with a block", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Existing room race"
    );
    await allowDirectAccess(pair.senderId, pair.recipientId);

    const outcomes = await Promise.allSettled([
      start(pair.senderId, pair.recipientUsername, "Activate existing room"),
      blockUser(pair.recipientId, pair.senderId),
    ]);
    expect(outcomes[1]?.status).toBe("fulfilled");

    const active = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chat_room_members
         WHERE room_id = ? AND membership_status = 'active'`
      )
      .bind(request.roomId)
      .first<{ count: number }>();
    expect(Number(active?.count)).toBe(0);
  });

  it("does not reactivate an accepted room when an old accept is replayed", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Accepted before block"
    );
    await respondToChatRequest({
      requestId: request.requestId!,
      userId: pair.recipientId,
      accept: true,
    });

    await blockUser(pair.recipientId, pair.senderId);
    await unblockUser(pair.recipientId, pair.senderId);
    await expect(
      respondToChatRequest({
        requestId: request.requestId!,
        userId: pair.recipientId,
        accept: true,
      })
    ).resolves.toMatchObject({
      roomId: request.roomId,
      status: "accepted",
    });

    const members = await env.DB
      .prepare(
        `SELECT membership_status
         FROM chat_room_members
         WHERE room_id = ?`
      )
      .bind(request.roomId)
      .all<{ membership_status: string }>();
    expect(members.results?.every((row) => row.membership_status === "left")).toBe(
      true
    );
    expect(await listChatRooms(pair.senderId)).toHaveLength(0);
    expect(await listChatRooms(pair.recipientId)).toHaveLength(0);
  });

  it("cancels a legacy NULL request-id orphan with the follow-up migration", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Legacy orphan"
    );
    await env.DB.batch([
      env.DB
        .prepare(`UPDATE chat_requests SET request_id = NULL WHERE id = ?`)
        .bind(request.requestId),
      env.DB
        .prepare(
          `UPDATE chat_messages
           SET request_id = NULL
           WHERE room_id = ? AND sender_id = ? AND delivery_status = 'pending'`
        )
        .bind(request.roomId, pair.senderId),
      env.DB
        .prepare(
          `DELETE FROM chat_messages
           WHERE room_id = ? AND sender_id = ? AND delivery_status = 'pending'`
        )
        .bind(request.roomId, pair.senderId),
    ]);

    await env.DB.batch([
      env.DB
        .prepare(
          `UPDATE chat_requests
           SET status = 'cancelled',
               responded_at = COALESCE(responded_at, datetime('now'))
           WHERE status = 'pending'
             AND NOT EXISTS (
               SELECT 1
               FROM chat_messages m
               WHERE m.room_id = chat_requests.room_id
                 AND m.sender_id = chat_requests.from_user_id
                 AND m.delivery_status = 'pending'
                 AND (
                   (chat_requests.request_id IS NOT NULL
                    AND m.request_id = chat_requests.request_id)
                   OR (
                     chat_requests.request_id IS NULL
                     AND m.request_id IS NULL
                   )
                 )
             )`
        ),
      env.DB
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'declined',
               joined_at = NULL
           WHERE membership_status = 'pending'
             AND EXISTS (
               SELECT 1
               FROM chat_requests r
               WHERE r.room_id = chat_room_members.room_id
                 AND r.to_user_id = chat_room_members.user_id
                 AND r.status = 'cancelled'
             )
             AND NOT EXISTS (
               SELECT 1
               FROM chat_requests r
               WHERE r.room_id = chat_room_members.room_id
                 AND r.to_user_id = chat_room_members.user_id
                 AND r.status = 'pending'
             )`
        ),
    ]);

    const status = await env.DB
      .prepare(
        `SELECT r.status, m.membership_status
         FROM chat_requests r
         INNER JOIN chat_room_members m
           ON m.room_id = r.room_id AND m.user_id = r.to_user_id
         WHERE r.id = ?`
      )
      .bind(request.requestId)
      .first<{ status: string; membership_status: string }>();
    expect(status).toEqual({
      status: "cancelled",
      membership_status: "declined",
    });
  });

  it("requires the matching visible opener for incoming requests", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Visible opener"
    );
    await env.DB
      .prepare(
        `INSERT INTO chat_messages (
           id, room_id, sender_id, body, delivery_status, is_shadow_hidden,
           request_id
         ) VALUES (?, ?, ?, ?, 'pending', 1, ?)`
      )
      .bind(
        crypto.randomUUID(),
        request.roomId,
        pair.senderId,
        "Unrelated shadow message",
        crypto.randomUUID()
      )
      .run();

    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(1);

    await env.DB
      .prepare(
        `UPDATE chat_messages
         SET is_shadow_hidden = 1
         WHERE room_id = ? AND sender_id = ?
           AND delivery_status = 'pending'
           AND is_shadow_hidden = 0`
      )
      .bind(request.roomId, pair.senderId)
      .run();
    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);
  });

  it("keeps a hidden pending opener while hiding it from incoming requests", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const request = await start(
      pair.senderId,
      pair.recipientUsername,
      "Hidden opener"
    );

    await env.DB.batch([
      env.DB
        .prepare(
          `UPDATE chat_messages
           SET is_shadow_hidden = 1
           WHERE room_id = ? AND sender_id = ? AND delivery_status = 'pending'`
        )
        .bind(request.roomId, pair.senderId),
      env.DB
        .prepare(
          `UPDATE chat_requests
           SET status = 'cancelled',
               responded_at = COALESCE(responded_at, datetime('now'))
           WHERE status = 'pending'
             AND NOT EXISTS (
               SELECT 1
               FROM chat_messages m
               WHERE m.room_id = chat_requests.room_id
                 AND m.sender_id = chat_requests.from_user_id
                 AND m.delivery_status = 'pending'
                 AND (
                   (chat_requests.request_id IS NOT NULL
                    AND m.request_id = chat_requests.request_id)
                   OR (
                     chat_requests.request_id IS NULL
                     AND m.request_id IS NULL
                   )
                 )
             )`
        ),
      env.DB
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'declined',
               joined_at = NULL
           WHERE membership_status = 'pending'
             AND EXISTS (
               SELECT 1
               FROM chat_requests r
               WHERE r.room_id = chat_room_members.room_id
                 AND r.to_user_id = chat_room_members.user_id
                 AND r.status = 'cancelled'
             )
             AND NOT EXISTS (
               SELECT 1
               FROM chat_requests r
               WHERE r.room_id = chat_room_members.room_id
                 AND r.to_user_id = chat_room_members.user_id
                 AND r.status = 'pending'
             )`
        ),
    ]);

    const status = await env.DB
      .prepare(`SELECT status FROM chat_requests WHERE id = ?`)
      .bind(request.requestId)
      .first<{ status: string }>();
    expect(status?.status).toBe("pending");
    expect(await listIncomingRequests(pair.recipientId)).toHaveLength(0);
  });

  it("advances a block read boundary by the same latest message tuple", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    await allowDirectAccess(pair.senderId, pair.recipientId);
    const room = await start(
      pair.senderId,
      pair.recipientUsername,
      "Direct boundary opener"
    );
    const first = await sendChatMessage({
      roomId: room.roomId,
      userId: pair.senderId,
      body: "Same timestamp one",
    });
    const second = await sendChatMessage({
      roomId: room.roomId,
      userId: pair.senderId,
      body: "Same timestamp two",
    });
    const sameCreatedAt = "2026-01-01 00:00:00.000";
    await env.DB
      .prepare(
        `UPDATE chat_messages SET created_at = ?
         WHERE room_id = ? AND delivery_status = 'delivered'`
      )
      .bind(sameCreatedAt, room.roomId)
      .run();

    await blockUser(pair.recipientId, pair.senderId);

    const latest = await env.DB
      .prepare(
        `SELECT id, created_at
         FROM chat_messages
         WHERE room_id = ? AND delivery_status = 'delivered'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .bind(room.roomId)
      .first<{ id: string; created_at: string }>();
    const boundaries = await env.DB
      .prepare(
        `SELECT user_id, last_read_at, last_read_message_id
         FROM chat_room_members
         WHERE room_id = ? AND user_id IN (?, ?)
         ORDER BY user_id`
      )
      .bind(room.roomId, pair.recipientId, pair.senderId)
      .all<{
        user_id: string;
        last_read_at: string | null;
        last_read_message_id: string | null;
      }>();
    const expectedBoundaries = [pair.recipientId, pair.senderId]
      .sort()
      .map((user_id) => ({
        user_id,
        last_read_at: latest?.created_at,
        last_read_message_id: latest?.id,
      }));
    expect(boundaries.results ?? []).toEqual(expectedBoundaries);
    expect(first.id).not.toBe(second.id);
  });

  it("does not move a later existing block read boundary backward", async () => {
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    await allowDirectAccess(pair.senderId, pair.recipientId);
    const room = await start(
      pair.senderId,
      pair.recipientUsername,
      "Later boundary opener"
    );
    await env.DB
      .prepare(
        `UPDATE chat_room_members
         SET last_read_at = ?, last_read_message_id = ?
         WHERE room_id = ? AND user_id = ?`
      )
      .bind(
        "2099-01-01 00:00:00.000",
        "future-read-boundary",
        room.roomId,
        pair.recipientId
      )
      .run();

    await blockUser(pair.recipientId, pair.senderId);

    const boundary = await env.DB
      .prepare(
        `SELECT last_read_at, last_read_message_id
         FROM chat_room_members
         WHERE room_id = ? AND user_id = ?`
      )
      .bind(room.roomId, pair.recipientId)
      .first<{ last_read_at: string | null; last_read_message_id: string | null }>();
    expect(boundary).toEqual({
      last_read_at: "2099-01-01 00:00:00.000",
      last_read_message_id: "future-read-boundary",
    });
  });

  it("starts a new unread epoch after unblock without resurrecting old history", async () => {
    await allowMultipleRequests();
    const pair = await seedPair(crypto.randomUUID().slice(0, 8));
    const first = await start(
      pair.senderId,
      pair.recipientUsername,
      "First epoch"
    );
    await respondToChatRequest({
      requestId: first.requestId!,
      userId: pair.recipientId,
      accept: true,
    });
    await sendChatMessage({
      roomId: first.roomId,
      userId: pair.senderId,
      body: "Old unread history",
    });
    await sendChatMessage({
      roomId: first.roomId,
      userId: pair.recipientId,
      body: "Old unread reply",
    });
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBeGreaterThan(0);
    expect((await getUnreadCounts(pair.senderId)).messageCount).toBeGreaterThan(0);

    await blockUser(pair.recipientId, pair.senderId);
    await Promise.all([
      refreshUnreadCounts(pair.recipientId),
      refreshUnreadCounts(pair.senderId),
    ]);
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBe(0);
    expect((await getUnreadCounts(pair.senderId)).messageCount).toBe(0);
    await unblockUser(pair.recipientId, pair.senderId);
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBe(0);
    expect((await getUnreadCounts(pair.senderId)).messageCount).toBe(0);

    await allowDirectAccess(pair.senderId, pair.recipientId);
    const replacement = await start(
      pair.senderId,
      pair.recipientUsername,
      "Second epoch"
    );
    expect(replacement.conversationType).toBe("direct");
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBe(1);
    expect((await getUnreadCounts(pair.senderId)).messageCount).toBe(0);

    await sendChatMessage({
      roomId: replacement.roomId,
      userId: pair.recipientId,
      body: "New unread history",
    });
    expect((await getUnreadCounts(pair.recipientId)).messageCount).toBe(1);
    expect((await getUnreadCounts(pair.senderId)).messageCount).toBe(1);
  });
});
