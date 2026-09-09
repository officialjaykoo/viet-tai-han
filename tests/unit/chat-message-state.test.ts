import { describe, expect, it } from "vitest";

import {
  mergeMessages,
  updateLocalDeliveryState,
  type LocalChatMessage,
} from "@/lib/chat-message-state";

function message(input: Partial<LocalChatMessage>): LocalChatMessage {
  return {
    id: "server-1",
    clientMessageId: "client-1",
    body: "hello",
    createdAt: "2026-08-14 12:00:00.000",
    isMine: true,
    senderUsername: null,
    ...input,
  };
}

describe("chat message client state", () => {
  it("replaces an optimistic bubble with the canonical HTTP message", () => {
    const optimistic = message({
      id: "local:client-1",
      createdAt: "2026-08-14T12:00:00.000Z",
      localDeliveryState: "sending",
    });
    const canonical = message({
      id: "server-1",
      createdAt: "2026-08-14 12:00:00.000",
    });

    const merged = mergeMessages([optimistic], [canonical]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "server-1",
      clientMessageId: "client-1",
      localDeliveryState: "sent",
    });
  });

  it("deduplicates a WebSocket message arriving before HTTP", () => {
    const optimistic = message({ id: "local:client-1" });
    const live = message({ id: "server-1", body: "hello from live" });
    const canonical = message({ id: "server-1", body: "hello from http" });

    const afterLive = mergeMessages([optimistic], [live]);
    const afterHttp = mergeMessages(afterLive, [canonical]);

    expect(afterLive).toHaveLength(1);
    expect(afterHttp).toHaveLength(1);
    expect(afterHttp[0]?.id).toBe("server-1");
  });

  it("keeps a failed bubble and retries with the same client ID", () => {
    const optimistic = message({ id: "local:client-1" });
    const failed = updateLocalDeliveryState(
      [optimistic],
      "client-1",
      "failed"
    );
    const retrying = updateLocalDeliveryState(
      failed,
      "client-1",
      "sending"
    );
    const canonical = mergeMessages(
      retrying,
      [message({ id: "server-1" })]
    );

    expect(failed[0]?.localDeliveryState).toBe("failed");
    expect(retrying[0]?.clientMessageId).toBe("client-1");
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.localDeliveryState).toBe("sent");
  });

  it("uses server ID or my client ID without merging another sender", () => {
    const mine = message({ id: "local:client-1" });
    const otherSender = message({
      id: "server-2",
      clientMessageId: "client-1",
      isMine: false,
      body: "other",
    });

    const merged = mergeMessages([mine], [otherSender]);

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.id)).toContain("local:client-1");
    expect(merged.map((item) => item.id)).toContain("server-2");
  });
  it("never downgrades a canonical sent row after a late transport error", () => {
    const canonical = message({
      id: "server-1",
      localDeliveryState: "sent",
    });

    const next = updateLocalDeliveryState(
      [canonical],
      "client-1",
      "failed"
    );

    expect(next[0]?.localDeliveryState).toBe("sent");
  });
});
