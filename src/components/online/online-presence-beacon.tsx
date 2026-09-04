"use client";

import { useEffect } from "react";

import { apiFetch } from "@/lib/api-client";

export function OnlinePresenceBeacon({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    function sendPresence() {
      void apiFetch("/api/presence", {
        method: "POST",
      }).catch(() => {
        // Presence is best effort; the server list expires stale entries.
      });
    }

    sendPresence();
    const interval = window.setInterval(sendPresence, 60_000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return null;
}
