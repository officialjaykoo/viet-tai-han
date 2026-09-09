"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

export type UnreadCountKind = "notifications" | "messages";

type UnreadResponse = {
  notificationCount?: number;
  messageCount?: number;
};

export type UnreadChange = {
  notificationDelta?: number;
  messageDelta?: number;
  reconcile?: boolean;
};

export type UnreadChangeSource = "local" | "remote";

type UnreadChangeListener = (
  change: UnreadChange,
  source: UnreadChangeSource
) => void;

const UNREAD_CHANGE_EVENT = "vth-unread-changed";
const UNREAD_CHANGE_CHANNEL = "vth-unread";
const UNREAD_CHANGE_STORAGE_KEY = "vth-unread-changed";

let unreadChannel: BroadcastChannel | null = null;

function parseUnreadChange(value: unknown): UnreadChange | null {
  if (!value || typeof value !== "object") return null;
  const change = value as Partial<UnreadChange>;
  if (
    (change.notificationDelta !== undefined &&
      typeof change.notificationDelta !== "number") ||
    (change.messageDelta !== undefined &&
      typeof change.messageDelta !== "number") ||
    (change.reconcile !== undefined && typeof change.reconcile !== "boolean")
  ) {
    return null;
  }
  if (
    change.notificationDelta === undefined &&
    change.messageDelta === undefined &&
    change.reconcile !== true
  ) {
    return null;
  }
  return {
    ...(change.notificationDelta === undefined
      ? {}
      : { notificationDelta: change.notificationDelta }),
    ...(change.messageDelta === undefined
      ? {}
      : { messageDelta: change.messageDelta }),
    ...(change.reconcile === undefined ? {} : { reconcile: change.reconcile }),
  };
}

function getUnreadChannel(): BroadcastChannel | null {
  if (
    typeof window === "undefined" ||
    typeof BroadcastChannel === "undefined"
  ) {
    return null;
  }
  try {
    unreadChannel ??= new BroadcastChannel(UNREAD_CHANGE_CHANNEL);
    return unreadChannel;
  } catch {
    return null;
  }
}

export function subscribeUnreadChanged(
  listener: UnreadChangeListener
): () => void {
  const handleLocal = (event: Event) => {
    const detail =
      "detail" in event
        ? parseUnreadChange((event as CustomEvent<unknown>).detail)
        : null;
    if (detail) listener(detail, "local");
  };
  const handleRemote = (event: MessageEvent<unknown>) => {
    const detail = parseUnreadChange(event.data);
    if (detail) listener(detail, "remote");
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== UNREAD_CHANGE_STORAGE_KEY ||
      !event.newValue ||
      typeof event.newValue !== "string"
    ) {
      return;
    }
    try {
      const payload = JSON.parse(event.newValue) as { change?: unknown };
      const detail = parseUnreadChange(payload.change);
      if (detail) listener(detail, "remote");
    } catch {
      // Ignore malformed cross-tab storage events.
    }
  };

  window.addEventListener(UNREAD_CHANGE_EVENT, handleLocal);
  window.addEventListener("storage", handleStorage);
  const channel = getUnreadChannel();
  channel?.addEventListener("message", handleRemote);

  return () => {
    window.removeEventListener(UNREAD_CHANGE_EVENT, handleLocal);
    window.removeEventListener("storage", handleStorage);
    channel?.removeEventListener("message", handleRemote);
  };
}

export function useUnreadCount(kind: UnreadCountKind): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch("/api/unread?count=1");
        if (!response.ok || !active) return;
        const data = (await response.json().catch(() => null)) as UnreadResponse | null;
        if (!active) return;
        setCount(
          kind === "notifications"
            ? Number(data?.notificationCount ?? 0)
            : Number(data?.messageCount ?? 0)
        );
      } catch {
        // Unread refresh is best-effort; retain the last known count on network failure.
      }
    }
    void load();
    const unsubscribe = subscribeUnreadChanged((detail) => {
      const delta =
        kind === "notifications"
          ? detail.notificationDelta
          : detail.messageDelta;
      if (typeof delta === "number" && !detail.reconcile) {
        setCount((current) => Math.max(0, current + delta));
        return;
      }
      if (detail.reconcile) void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [kind]);

  return count;
}

export function announceUnreadChanged(
  change: UnreadChange = { reconcile: true }
) {
  if (typeof window === "undefined") return;
  const detail = parseUnreadChange(change);
  if (!detail) return;
  window.dispatchEvent(
    new CustomEvent<UnreadChange>(UNREAD_CHANGE_EVENT, { detail })
  );
  const channel = getUnreadChannel();
  if (channel) {
    channel.postMessage(detail);
    return;
  }
  try {
    window.localStorage.setItem(
      UNREAD_CHANGE_STORAGE_KEY,
      JSON.stringify({
        id: crypto.randomUUID(),
        change: detail,
      })
    );
  } catch {
    // Cross-tab reconciliation is best-effort when storage is blocked.
  }
}
