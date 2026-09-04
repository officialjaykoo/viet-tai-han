"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useUnreadCount } from "@/components/notifications/use-unread-count";
import { cn } from "@/lib/utils";

export function NotificationsBell({ className }: { className?: string }) {
  const { t } = useI18n();
  const unread = useUnreadCount("notifications");

  return (
    <Link
      href="/notifications"
      className={cn(
        "touch-target relative inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      aria-label={
        unread > 0
          ? t("notifications.unreadCount", { count: unread })
          : t("nav.notifications")
      }
    >
      <BellIcon className="size-5" />
      {unread > 0 ? (
        <span className="absolute top-1 right-1 grid min-w-4 translate-x-px -translate-y-px place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-[var(--brand-foreground)] tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
