import { getDb, getEnv } from "@/lib/db";

export type ChatRealtimeMessage = {
  roomId: string;
  id: string;
  clientMessageId: string | null;
  body: string;
  createdAt: string;
  senderId: string;
  senderUsername: string | null;
};

/**
 * Broadcast a committed chat message to the room's hibernatable WebSockets.
 * D1 remains authoritative, so a delivery failure never fails the send itself.
 */
export async function broadcastChatMessage(input: ChatRealtimeMessage) {
  try {
    const env = await getEnv();
    const chatRoom = (env as CloudflareEnv & {
      CHAT_ROOM?: DurableObjectNamespace;
    }).CHAT_ROOM;
    if (!chatRoom) return;

    const stub = chatRoom.get(chatRoom.idFromName(input.roomId));
    const response = await stub.fetch(
      `https://vth-chat-room/broadcast?room=${encodeURIComponent(input.roomId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      throw new Error(`Chat realtime broadcast failed (${response.status})`);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        msg: "chat_realtime_broadcast_failed",
        roomId: input.roomId,
        messageId: input.id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
export async function revokeChatRoom(
  roomId: string,
  reason: "membership_revoked" | "account_banned" = "membership_revoked"
) {
  try {
    const env = await getEnv();
    const chatRoom = (env as CloudflareEnv & {
      CHAT_ROOM?: DurableObjectNamespace;
    }).CHAT_ROOM;
    if (!chatRoom) return;

    const stub = chatRoom.get(chatRoom.idFromName(roomId));
    const response = await stub.fetch(
      `https://vth-chat-room/revoke?room=${encodeURIComponent(roomId)}&reason=${encodeURIComponent(reason)}`,
      {
        method: "POST",
        headers: {
          "X-VTH-Realtime-Token": env.BETTER_AUTH_SECRET,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Chat realtime revoke failed (${response.status})`);
    }
    console.info(
      JSON.stringify({
        level: "info",
        msg: "chat_realtime_revoked",
        roomId,
        reason,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        msg: "chat_realtime_revoke_failed",
        roomId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

export async function revokeChatRoomsForUser(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT DISTINCT room_id
       FROM chat_room_members
       WHERE user_id = ?`
    )
    .bind(userId)
    .all<{ room_id: string }>();
  await Promise.allSettled(
    (results ?? []).map((row) => revokeChatRoom(row.room_id, "account_banned"))
  );
}
