export const CHAT_SLOW_REQUEST_MS = 250;

export type ChatTiming = {
  authMs?: number;
  authorizeMs?: number;
  rateMs?: number;
  moderationMs?: number;
  dbWriteMs?: number;
  totalMs?: number;
  d1ReadStatements?: number;
  d1WriteStatements?: number;
  d1BatchRoundTrips?: number;
};

export function formatChatServerTiming(timing: ChatTiming): string {
  return Object.entries(timing)
    .filter(
      ([key, value]) =>
        key.endsWith("Ms") &&
        typeof value === "number" &&
        Number.isFinite(value)
    )
    .map(([key, value]) => {
      const metric = key
        .slice(0, -2)
        .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `${metric};dur=${Math.max(0, value as number).toFixed(1)}`;
    })
    .join(", ");
}
