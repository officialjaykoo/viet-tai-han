import { getEnv } from "@/lib/db";

export type ChatRealtimeMessage = {
  roomId: string;
  id: string;
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
    console.error("chat realtime broadcast failed", error);
  }
}
