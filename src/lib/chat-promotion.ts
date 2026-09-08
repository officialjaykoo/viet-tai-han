import { runBackgroundTask } from "@/lib/background-task";
import type { ChatPromotionReason } from "@/lib/messages";

export function scheduleChatPromotion(input: {
  firstUserId: string;
  secondUserId: string;
  reason: ChatPromotionReason;
}) {
  runBackgroundTask(`chat_promotion_${input.reason}`, async () => {
    const { promotePendingChatRequestsForPair } = await import("@/lib/messages");
    await promotePendingChatRequestsForPair(
      input.firstUserId,
      input.secondUserId,
      input.reason
    );
  });
}
