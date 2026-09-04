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
        isMine: true,
        senderUsername: senderId,
      },
    });
    expect(JSON.parse(await recipientMessage)).toMatchObject({
      type: "message",
      roomId,
      message: {
        body: "Hello in real time",
        isMine: false,
        senderUsername: senderId,
      },
    });

    sender.socket.close();
    recipient.socket.close();
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
