import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  getChatMessages,
  listChatRooms,
  respondToChatRequest,
  sendChatMessage,
  startChatRequest,
  markChatMessagesRead,
} from "@/lib/messages";
import { AuthError } from "@/lib/session";
import { getUnreadCounts } from "@/lib/unread";
import { seedUsersAndSubreddit } from "./helpers";

const SAME_MILLISECOND = "2026-08-14 12:00:00.000";

async function createActiveRoom() {
  const seeded = await seedUsersAndSubreddit();
  const roomId = `room_reliability_${crypto.randomUUID().slice(0, 8)}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO chat_rooms
       (id, kind, pair_key, created_by, created_at, last_message_at)
       VALUES (?, 'dm', ?, ?, ?, ?)`
    ).bind(
      roomId,
      [seeded.authorId, seeded.actorId].sort().join(":"),
      seeded.authorId,
      SAME_MILLISECOND,
      SAME_MILLISECOND
    ),
    env.DB.prepare(
      `INSERT INTO chat_room_members
       (room_id, user_id, role, membership_status, joined_at)
       VALUES (?, ?, 'owner', 'active', ?), (?, ?, 'member', 'active', ?)`
    ).bind(
      roomId,
      seeded.authorId,
      SAME_MILLISECOND,
      roomId,
      seeded.actorId,
      SAME_MILLISECOND
    ),
  ]);
  return { ...seeded, roomId };
}

async function insertDeliveredMessage(input: {
  roomId: string;
  senderId: string;
  id: string;
  body?: string;
  createdAt?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO chat_messages
     (id, room_id, sender_id, body, delivery_status, is_shadow_hidden, created_at)
     VALUES (?, ?, ?, ?, 'delivered', 0, ?)`
  )
    .bind(
      input.id,
      input.roomId,
      input.senderId,
      input.body ?? input.id,
      input.createdAt ?? SAME_MILLISECOND
    )
    .run();
}

describe("chat reliability (D1)", () => {
  it("returns one canonical row for a retried client message id", async () => {
    const { authorId, actorId, roomId } = await createActiveRoom();
    const clientMessageId = `client_${crypto.randomUUID()}`;
    const first = await sendChatMessage({
      roomId,
      userId: authorId,
      body: "first body",
      userStatus: "active",
      clientMessageId,
    });
    const retry = await sendChatMessage({
      roomId,
      userId: authorId,
      body: "body changed after response loss",
      userStatus: "active",
      clientMessageId,
    });

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.id).toBe(first.id);
    expect(retry.body).toBe("first body");
    expect(retry.clientMessageId).toBe(clientMessageId);
    expect(
      await env.DB
        .prepare(
          `SELECT COUNT(*) AS count
           FROM chat_messages
           WHERE room_id = ? AND sender_id = ? AND client_message_id = ?`
        )
        .bind(roomId, authorId, clientMessageId)
        .first<{ count: number }>()
    ).toEqual({ count: 1 });
    expect(first.serverTiming).toMatchObject({
      d1ReadStatements: 1,
      d1WriteStatements: 2,
      d1BatchRoundTrips: 1,
    });
    expect(
      await env.DB
        .prepare(
          `SELECT COUNT(*) AS count
           FROM security_rate_events
           WHERE subject = ? AND action IN ('dm_message', 'dm_message:burst')`
        )
        .bind(`user:${authorId}`)
        .first<{ count: number }>()
    ).toEqual({ count: 0 });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(1);
  });
  it("keeps shadow-hidden sends out of recipient delivery", async () => {
    const { actorId, authorId, roomId } = await createActiveRoom();
    const message = await sendChatMessage({
      roomId,
      userId: authorId,
      body: "shadow-only body",
      userStatus: "shadowbanned",
      clientMessageId: `shadow_${crypto.randomUUID()}`,
    });

    expect(message.created).toBe(true);
    expect(message.shouldBroadcast).toBe(false);
    expect(
      (await getChatMessages({ roomId, userId: actorId })).messages
    ).toHaveLength(0);
    expect(
      (await getChatMessages({ roomId, userId: authorId })).messages
    ).toHaveLength(1);
    expect((await getUnreadCounts(actorId)).messageCount).toBe(0);
  });

  it("pages complete history with a deterministic same-millisecond tuple", async () => {
    const { actorId, authorId, roomId } = await createActiveRoom();
    const ids = Array.from({ length: 6 }, (_, index) =>
      `${roomId}_message_${String(index + 1).padStart(2, "0")}`
    );
    for (const id of ids) {
      await insertDeliveredMessage({ roomId, senderId: authorId, id });
    }

    const initial = await getChatMessages({ roomId, userId: actorId, limit: 2 });
    expect(initial.messages.map((message) => message.id)).toEqual(ids.slice(-2));
    expect(initial.hasMoreBefore).toBe(true);
    expect(initial.nextBeforeCursor).toBeTruthy();
    expect(initial.nextAfterCursor).toBeTruthy();

    const collected = [...initial.messages.map((message) => message.id)];
    let page = initial;
    while (page.nextBeforeCursor) {
      page = await getChatMessages({
        roomId,
        userId: actorId,
        limit: 2,
        before: page.nextBeforeCursor,
      });
      collected.unshift(...page.messages.map((message) => message.id));
      if (!page.hasMoreBefore) break;
    }
    expect(collected).toEqual(ids);
    expect(new Set(collected).size).toBe(ids.length);

    for (const id of [
      `${roomId}_message_07`,
      `${roomId}_message_08`,
      `${roomId}_message_09`,
      `${roomId}_message_10`,
    ]) {
      await insertDeliveredMessage({ roomId, senderId: authorId, id });
    }
    const catchupIds: string[] = [];
    let catchup = await getChatMessages({
      roomId,
      userId: actorId,
      limit: 2,
      after: initial.nextAfterCursor,
    });
    while (true) {
      catchupIds.push(...catchup.messages.map((message) => message.id));
      if (!catchup.hasMoreAfter) break;
      catchup = await getChatMessages({
        roomId,
        userId: actorId,
        limit: 2,
        after: catchup.nextAfterCursor,
      });
    }
    expect(catchupIds).toEqual([
      `${roomId}_message_07`,
      `${roomId}_message_08`,
      `${roomId}_message_09`,
      `${roomId}_message_10`,
    ]);

  });
  it("loads and paginates a large room from the latest page", async () => {
    const { actorId, authorId, roomId } = await createActiveRoom();
    const ids = Array.from(
      { length: 500 },
      (_, index) => `${roomId}_large_${String(index + 1).padStart(3, "0")}`
    );
    await env.DB.batch(
      ids.map((id) =>
        env.DB.prepare(
          `INSERT INTO chat_messages
           (id, room_id, sender_id, body, delivery_status, is_shadow_hidden, created_at)
           VALUES (?, ?, ?, ?, 'delivered', 0, ?)`
        ).bind(id, roomId, authorId, id, SAME_MILLISECOND)
      )
    );

    const initial = await getChatMessages({
      roomId,
      userId: actorId,
      limit: 50,
    });
    expect(initial.messages.map((message) => message.id)).toEqual(
      ids.slice(-50)
    );
    expect(initial.messages).toHaveLength(50);
    expect(initial.hasMoreBefore).toBe(true);

    const collected = initial.messages.map((message) => message.id);
    let cursor = initial.nextBeforeCursor;
    while (cursor) {
      const page = await getChatMessages({
        roomId,
        userId: actorId,
        limit: 50,
        before: cursor,
      });
      collected.unshift(...page.messages.map((message) => message.id));
      cursor = page.hasMoreBefore ? page.nextBeforeCursor : null;
    }

    expect(collected).toEqual(ids);
    expect(new Set(collected).size).toBe(ids.length);
  });
  it("marks a monotonic tuple boundary without mutating history reads", async () => {
    const { actorId, authorId, roomId } = await createActiveRoom();
    const ids = ["read_01", "read_02", "read_03", "read_04"];
    for (const id of ids) {
      await insertDeliveredMessage({ roomId, senderId: authorId, id });
    }

    await getChatMessages({ roomId, userId: actorId });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(4);

    expect(
      await markChatMessagesRead({
        roomId,
        userId: actorId,
        messageId: "read_03",
      })
    ).toMatchObject({ messageId: "read_03", updated: true });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(1);

    expect(
      await markChatMessagesRead({
        roomId,
        userId: actorId,
        messageId: "read_02",
      })
    ).toMatchObject({ messageId: "read_02", updated: false });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(1);

    await markChatMessagesRead({
      roomId,
      userId: actorId,
      messageId: "read_04",
    });
    expect((await getUnreadCounts(actorId)).messageCount).toBe(0);
  });

  it("makes repeated acceptance idempotent and conflicting actions fail", async () => {
    const { authorId, actorId } = await seedUsersAndSubreddit();
    const username = await env.DB
      .prepare(`SELECT username FROM "user" WHERE id = ?`)
      .bind(actorId)
      .first<{ username: string }>();
    const request = await startChatRequest({
      fromUserId: authorId,
      toUsername: username!.username,
      openerBody: "Please accept this request.",
      fromStatus: "active",
      clientMessageId: `request_${crypto.randomUUID()}`,
    });

    await expect(
      respondToChatRequest({
        requestId: request.requestId,
        userId: actorId,
        accept: true,
      })
    ).resolves.toMatchObject({ status: "accepted" });
    await expect(
      respondToChatRequest({
        requestId: request.requestId,
        userId: actorId,
        accept: true,
      })
    ).resolves.toMatchObject({ status: "accepted" });
    await expect(
      respondToChatRequest({
        requestId: request.requestId,
        userId: actorId,
        accept: false,
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("orders room and preview ties by the message identity tuple", async () => {
    const { actorId, authorId, adminId } = await seedUsersAndSubreddit();
    const roomA = `room_order_a_${crypto.randomUUID().slice(0, 8)}`;
    const roomZ = `room_order_z_${crypto.randomUUID().slice(0, 8)}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO chat_rooms
         (id, kind, pair_key, created_by, created_at, last_message_at)
         VALUES (?, 'dm', ?, ?, ?, ?), (?, 'dm', ?, ?, ?, ?)`
      ).bind(
        roomA,
        [actorId, authorId].sort().join(":"),
        authorId,
        SAME_MILLISECOND,
        SAME_MILLISECOND,
        roomZ,
        [actorId, adminId].sort().join(":"),
        adminId,
        SAME_MILLISECOND,
        SAME_MILLISECOND
      ),
      env.DB.prepare(
        `INSERT INTO chat_room_members
         (room_id, user_id, role, membership_status)
         VALUES (?, ?, 'owner', 'active'), (?, ?, 'member', 'active'),
                (?, ?, 'owner', 'active'), (?, ?, 'member', 'active')`
      ).bind(roomA, actorId, roomA, authorId, roomZ, actorId, roomZ, adminId),
      env.DB.prepare(
        `INSERT INTO chat_messages
         (id, room_id, sender_id, body, delivery_status, is_shadow_hidden, created_at)
         VALUES (?, ?, ?, ?, 'delivered', 0, ?),
                (?, ?, ?, ?, 'delivered', 0, ?)`
      ).bind(
        "preview_01",
        roomA,
        authorId,
        "low preview",
        SAME_MILLISECOND,
        "preview_99",
        roomA,
        authorId,
        "high preview",
        SAME_MILLISECOND
      ),
    ]);

    const rooms = await listChatRooms(actorId);
    expect(rooms.slice(0, 2).map((room) => room.id)).toEqual([roomZ, roomA]);
    expect(rooms.find((room) => room.id === roomA)?.lastBody).toBe("high preview");
    expect(rooms.find((room) => room.id === roomA)?.lastMessageId).toBe(
      "preview_99"
    );
  });
});
