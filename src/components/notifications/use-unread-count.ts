"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

export type UnreadCountKind = "notifications" | "messages";

type UnreadResponse = {
  notificationCount?: number;
  messageCount?: number;
};

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
    const refresh = () => void load();
    window.addEventListener("vth-unread-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("vth-unread-changed", refresh);
    };
  }, [kind]);

  return count;
}

export function announceUnreadChanged() {
  window.dispatchEvent(new Event("vth-unread-changed"));
}
