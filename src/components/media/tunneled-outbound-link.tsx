"use client";

import { type MouseEvent, type ReactNode } from "react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Follows an outbound tracking link via POST /i/api, then opens the target.
 * Logical href stays inside the Protobuf envelope (never a direct /api GET).
 */
export function TunneledOutboundLink({
  href,
  children,
  className,
  target = "_blank",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    try {
      const res = await apiFetch(href);
      const data = (await res.json().catch(() => null)) as {
        redirect?: string;
      } | null;
      if (!res.ok || !data?.redirect) return;
      window.open(data.redirect, target, "noopener,noreferrer");
    } catch {
      // ignore
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(className)}
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
