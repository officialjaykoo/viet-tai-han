import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

function messageFrom(socket: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    socket.addEventListener(
      "message",
      (event) => resolve(String(event.data)),
      { once: true }
    );
  });
}

async function connect(
  roomId: string,
  userId: string
): Promise<{ socket: WebSocket; ready: Promise<string> }> {
  const stub = env.CHAT_ROOM.getByName(roomId);
  const response = await stub.fetch(
    new Request(`https://vth-chat-room/connect?room=${roomId}`, {
      headers: {
        Upgrade: "websocket",
        "X-VTH-User-ID": userId,
        "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
      },
    })
  );
  const socket = response.webSocket;
  if (!socket) throw new Error("WebSocket response did not include a client");
  const ready = messageFrom(socket);
  socket.accept();
  return { socket, ready };
}

describe("ChatRoom", () => {
  it("delivers committed messages to every active room connection", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const roomId = `room_${suffix}`;
    const senderId = `sender_${suffix}`;
    const recipientId = `recipient_${suffix}`;

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, username)
         VALUES (?, 'Sender', ?, 1, ?)`
      ).bind(senderId, `${senderId}@test.local`, senderId),
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, username)
         VALUES (?, 'Recipient', ?, 1, ?)`
      ).bind(recipientId, `${recipientId}@test.local`, recipientId),
      env.DB.prepare(
        `INSERT INTO chat_rooms (id, kind, pair_key, created_by)
         VALUES (?, 'dm', ?, ?)`
      ).bind(roomId, [senderId, recipientId].sort().join(":"), senderId),
      env.DB.prepare(
        `INSERT INTO chat_room_members (room_id, user_id, role, membership_status)
         VALUES (?, ?, 'owner', 'active'), (?, ?, 'member', 'active')`
      ).bind(roomId, senderId, roomId, recipientId),
    ]);

    const sender = await connect(roomId, senderId);
    const recipient = await connect(roomId, recipientId);
    expect(JSON.parse(await sender.ready)).toEqual({ type: "ready", roomId });
    expect(JSON.parse(await recipient.ready)).toEqual({ type: "ready", roomId });
    const heartbeat = messageFrom(sender.socket);
    sender.socket.send("ping");
    expect(await heartbeat).toBe("pong");
    const senderMessage = messageFrom(sender.socket);
    const recipientMessage = messageFrom(recipient.socket);


    const broadcast = await env.CHAT_ROOM.getByName(roomId).fetch(
      new Request(`https://vth-chat-room/broadcast?room=${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
        body: JSON.stringify({
          roomId,
          id: `message_${suffix}`,
          clientMessageId: `client_${suffix}`,
          body: "Hello in real time",
          createdAt: "2026-08-14T00:00:00.000Z",
          senderId,
          senderUsername: senderId,
        }),
      })
    );

    expect(await broadcast.json()).toEqual({ delivered: 2 });
    expect(JSON.parse(await senderMessage)).toMatchObject({

      type: "message",
      roomId,
      message: {
        body: "Hello in real time",
        clientMessageId: `client_${suffix}`,
      },
    });
    expect(JSON.parse(await recipientMessage)).toMatchObject({
      type: "message",
      roomId,
      message: {
        body: "Hello in real time",
        clientMessageId: `client_${suffix}`,
      },
    });

    sender.socket.close();
    recipient.socket.close();
  });
  it("revokes connected sockets before a delayed post-block broadcast", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const roomId = `room_block_${suffix}`;
    const senderId = `sender_block_${suffix}`;
    const recipientId = `recipient_block_${suffix}`;

    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO "user" (id, name, email, emailVerified, username)
           VALUES (?, 'Sender', ?, 1, ?)`
        )
        .bind(senderId, `${senderId}@test.local`, senderId),
      env.DB
        .prepare(
          `INSERT INTO "user" (id, name, email, emailVerified, username)
           VALUES (?, 'Recipient', ?, 1, ?)`
        )
        .bind(recipientId, `${recipientId}@test.local`, recipientId),
      env.DB
        .prepare(
          `INSERT INTO chat_rooms (id, kind, pair_key, created_by)
           VALUES (?, 'dm', ?, ?)`
        )
        .bind(roomId, [senderId, recipientId].sort().join(":"), senderId),
      env.DB
        .prepare(
          `INSERT INTO chat_room_members (room_id, user_id, role, membership_status)
           VALUES (?, ?, 'owner', 'active'), (?, ?, 'member', 'active')`
        )
        .bind(roomId, senderId, roomId, recipientId),
    ]);

    const sender = await connect(roomId, senderId);
    const recipient = await connect(roomId, recipientId);
    await sender.ready;
    await recipient.ready;
    const senderRevoked = messageFrom(sender.socket);
    const recipientRevoked = messageFrom(recipient.socket);

    await env.DB.batch([
      env.DB
        .prepare(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`)
        .bind(recipientId, senderId),
      env.DB
        .prepare(
          `UPDATE chat_room_members
           SET membership_status = 'left', joined_at = NULL
           WHERE room_id = ?`
        )
        .bind(roomId),
    ]);

    const delayedBroadcast = await env.CHAT_ROOM.getByName(roomId).fetch(
      new Request(`https://vth-chat-room/broadcast?room=${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
        body: JSON.stringify({
          roomId,
          id: `message_block_${suffix}`,
          clientMessageId: `client_block_${suffix}`,
          body: "Must not leak after block",
          createdAt: "2026-08-14T00:00:00.000Z",
          senderId,
          senderUsername: senderId,
        }),
      })
    );

    expect(await delayedBroadcast.json()).toEqual({ delivered: 0 });
    expect(JSON.parse(await senderRevoked)).toMatchObject({
      type: "revoked",
      roomId,
      reason: "membership_revoked",
    });
    expect(JSON.parse(await recipientRevoked)).toMatchObject({
      type: "revoked",
      roomId,
      reason: "membership_revoked",
    });
    sender.socket.close();
    recipient.socket.close();
  });

  it("closes an existing socket with the banned terminal reason", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const roomId = `room_ban_${suffix}`;
    const senderId = `sender_ban_${suffix}`;
    const recipientId = `recipient_ban_${suffix}`;

    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO "user" (id, name, email, emailVerified, username)
           VALUES (?, 'Sender', ?, 1, ?)`
        )
        .bind(senderId, `${senderId}@test.local`, senderId),
      env.DB
        .prepare(
          `INSERT INTO "user" (id, name, email, emailVerified, username)
           VALUES (?, 'Recipient', ?, 1, ?)`
        )
        .bind(recipientId, `${recipientId}@test.local`, recipientId),
      env.DB
        .prepare(
          `INSERT INTO chat_rooms (id, kind, pair_key, created_by)
           VALUES (?, 'dm', ?, ?)`
        )
        .bind(roomId, [senderId, recipientId].sort().join(":"), senderId),
      env.DB
        .prepare(
          `INSERT INTO chat_room_members (room_id, user_id, role, membership_status)
           VALUES (?, ?, 'owner', 'active'), (?, ?, 'member', 'active')`
        )
        .bind(roomId, senderId, roomId, recipientId),
    ]);

    const sender = await connect(roomId, senderId);
    await sender.ready;
    const revoked = messageFrom(sender.socket);
    await env.DB
      .prepare(`UPDATE "user" SET status = 'banned' WHERE id = ?`)
      .bind(senderId)
      .run();

    const revoke = await env.CHAT_ROOM.getByName(roomId).fetch(
      new Request(
        `https://vth-chat-room/revoke?room=${roomId}&reason=account_banned`,
        {
          method: "POST",
          headers: {
            "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
          },
        }
      )
    );

    expect(await revoke.json()).toEqual({ revoked: 1 });
    expect(JSON.parse(await revoked)).toMatchObject({
      type: "revoked",
      roomId,
      reason: "account_banned",
    });
    sender.socket.close();
  });

  it("rejects pending members and blocked peers", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const roomId = `room_${suffix}`;
    const senderId = `sender_${suffix}`;
    const recipientId = `recipient_${suffix}`;

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, username)
         VALUES (?, 'Sender', ?, 1, ?)`
      ).bind(senderId, `${senderId}@test.local`, senderId),
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, username)
         VALUES (?, 'Recipient', ?, 1, ?)`
      ).bind(recipientId, `${recipientId}@test.local`, recipientId),
      env.DB.prepare(
        `INSERT INTO chat_rooms (id, kind, pair_key, created_by)
         VALUES (?, 'dm', ?, ?)`
      ).bind(roomId, [senderId, recipientId].sort().join(":"), senderId),
      env.DB.prepare(
        `INSERT INTO chat_room_members (room_id, user_id, role, membership_status)
         VALUES (?, ?, 'owner', 'active'), (?, ?, 'member', 'pending')`
      ).bind(roomId, senderId, roomId, recipientId),
    ]);

    const pending = await env.CHAT_ROOM.getByName(roomId).fetch(
      new Request(`https://vth-chat-room/connect?room=${roomId}`, {
        headers: {
          Upgrade: "websocket",
          "X-VTH-User-ID": recipientId,
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
      })
    );
    expect(pending.status).toBe(404);

    await env.DB.prepare(
      `UPDATE chat_room_members
       SET membership_status = 'active'
       WHERE room_id = ? AND user_id = ?`
    )
      .bind(roomId, recipientId)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
    )
      .bind(recipientId, senderId)
      .run();

    const blocked = await env.CHAT_ROOM.getByName(roomId).fetch(
      new Request(`https://vth-chat-room/connect?room=${roomId}`, {
        headers: {
          Upgrade: "websocket",
          "X-VTH-User-ID": senderId,
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
      })
    );
    expect(blocked.status).toBe(404);
  });
});
