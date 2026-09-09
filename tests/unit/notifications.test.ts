import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDb,
  queuePushDelivery,
  getUnreadCounts,
  decrementUnread,
  runBackgroundTask,
  AuthError,
} = vi.hoisted(() => {
  class TestAuthError extends Error {
    status: number;

    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  }

  return {
    getDb: vi.fn(),
    queuePushDelivery: vi.fn(),
    getUnreadCounts: vi.fn(),
    decrementUnread: vi.fn(),
    runBackgroundTask: vi.fn(),
    AuthError: TestAuthError,
  };
});

vi.mock("@/lib/db", () => ({ getDb }));
vi.mock("@/lib/push", () => ({ queuePushDelivery }));
vi.mock("@/lib/unread", () => ({ getUnreadCounts, decrementUnread }));
vi.mock("@/lib/background-task", () => ({ runBackgroundTask }));
vi.mock("@/lib/session", () => ({ AuthError }));

import { createNotification } from "@/lib/notifications";

function setupDatabase(notificationChanges: number) {
  const first = vi.fn().mockResolvedValue({
    notifyComments: 1,
    notifyFollows: 1,
    notifyChat: 1,
    notifyMentions: 1,
  });
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  const batch = vi.fn().mockResolvedValue([
    { meta: { changes: notificationChanges } },
    { meta: { changes: notificationChanges } },
  ]);
  const db = { prepare, batch };
  getDb.mockResolvedValue(db);
  return { batch, prepare, bind, first };
}

describe("notification insert invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not enqueue push when the guarded insert changes zero rows", async () => {
    const { batch } = setupDatabase(0);

    await expect(
      createNotification({
        userId: "recipient-1",
        actorId: "blocked-actor",
        kind: "chat_request",
        sourceRequestId: "request-1",
        title: "Blocked request",
      })
    ).resolves.toBeNull();

    expect(batch).toHaveBeenCalledOnce();
    expect(queuePushDelivery).not.toHaveBeenCalled();
  });
  it.each(["comment_on_post", "reply_to_comment", "mention"] as const)(
    "applies bilateral block guard to %s",
    async (kind) => {
      const { batch, prepare } = setupDatabase(0);

      await expect(
        createNotification({
          userId: "recipient-1",
          actorId: "blocked-actor",
          kind,
          title: "Blocked content event",
        })
      ).resolves.toBeNull();

      expect(batch).toHaveBeenCalledOnce();
      expect(
        prepare.mock.calls.some(([sql]) =>
          String(sql).includes("FROM user_blocks")
        )
      ).toBe(true);
    }
  );
});
