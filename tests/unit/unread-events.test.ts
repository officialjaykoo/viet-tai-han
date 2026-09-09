import { afterEach, describe, expect, it } from "vitest";

import {
  announceUnreadChanged,
  subscribeUnreadChanged,
  type UnreadChange,
  type UnreadChangeSource,
} from "@/components/notifications/use-unread-count";

class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];

  constructor(readonly name: string) {
    super();
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage() {}

  close() {}
}

const globalRecord = globalThis as typeof globalThis & {
  window?: Window;
  BroadcastChannel?: typeof BroadcastChannel;
};
const originalWindow = globalRecord.window;
const originalBroadcastChannel = globalRecord.BroadcastChannel;

function installWindow() {
  const target = new EventTarget();
  const values = new Map<string, string>();
  const fakeWindow = Object.assign(target, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  }) as unknown as Window;
  globalRecord.window = fakeWindow;
  FakeBroadcastChannel.instances = [];
  globalRecord.BroadcastChannel =
    FakeBroadcastChannel as unknown as typeof BroadcastChannel;
}

afterEach(() => {
  globalRecord.window = originalWindow;
  globalRecord.BroadcastChannel = originalBroadcastChannel;
});

describe("cross-tab unread events", () => {
  it("delivers local changes and broadcasts remote changes", () => {
    installWindow();
    const received: Array<{
      change: UnreadChange;
      source: UnreadChangeSource;
    }> = [];
    const unsubscribe = subscribeUnreadChanged((change, source) => {
      received.push({ change, source });
    });

    announceUnreadChanged({ messageDelta: 1 });
    expect(received).toEqual([
      { change: { messageDelta: 1 }, source: "local" },
    ]);

    const channel = FakeBroadcastChannel.instances[0];
    expect(channel?.name).toBe("vth-unread");
    channel?.dispatchEvent(
      Object.assign(new Event("message"), {
        data: { reconcile: true },
      })
    );
    expect(received[1]).toEqual({
      change: { reconcile: true },
      source: "remote",
    });

    unsubscribe();
  });

  it("accepts storage events as a BroadcastChannel fallback", () => {
    installWindow();
    const received: Array<{
      change: UnreadChange;
      source: UnreadChangeSource;
    }> = [];
    const unsubscribe = subscribeUnreadChanged((change, source) => {
      received.push({ change, source });
    });
    const event = Object.assign(new Event("storage"), {
      key: "vth-unread-changed",
      newValue: JSON.stringify({
        id: "other-tab",
        change: { messageDelta: 2 },
      }),
    });

    window.dispatchEvent(event);

    expect(received).toEqual([
      { change: { messageDelta: 2 }, source: "remote" },
    ]);
    unsubscribe();
  });
});
