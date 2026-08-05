"use client";

import { useEffect, useRef } from "react";

import type { DiscoverySource } from "@/lib/vote-weight";
import { apiFetch, apiJson } from "@/lib/api-client";

const SESSION_KEY = "red_view_session";

function getSessionKey(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function PostViewBeacon({
  postId,
  discoverySource = "direct",
}: {
  postId: string;
  discoverySource?: DiscoverySource | string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    let referrerHost: string | undefined;
    try {
      if (document.referrer) {
        referrerHost = new URL(document.referrer).host;
      }
    } catch {
      referrerHost = undefined;
    }

    void apiFetch(`/api/posts/${postId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discoverySource,
        sessionKey: getSessionKey(),
        referrerHost,
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics must not break the page
    });
  }, [postId, discoverySource]);

  return null;
}
