"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";
import { RelativeTime } from "@/components/time/relative-time";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-client";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    username: string | null;
    displayName: string | null;
    image: string | null;
  } | null;
};

const KIND_KEYS: Record<string, MessageKey> = {
  comment_on_post: "notify.commentOnPost",
  reply_to_comment: "notify.replyToComment",
  follow: "notify.follow",
  chat_request: "notify.chatRequest",
  chat_accepted: "notify.chatAccepted",
  warning: "notify.warning",
  mention: "notify.mention",
};

export function NotificationsClient() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/notifications");
    if (res.status === 401) {
      router.push("/login?next=/notifications");
      return;
    }
    if (!res.ok) {
      setError(t("notifications.loadError"));
      return;
    }
    const data = (await res.json()) as { notifications: NotificationItem[] };
    setItems(data.notifications);
    setError(null);
  }, [router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function markAll() {
    startTransition(async () => {
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      await load();
    });
  }

  function openItem(item: NotificationItem) {
    startTransition(async () => {
      if (!item.isRead) {
        await apiFetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", ids: [item.id] }),
        });
      }
      if (item.href) router.push(item.href);
      else await load();
    });
  }

  function titleFor(item: NotificationItem): string {
    const key = KIND_KEYS[item.kind];
    if (!key) return item.title;
    const actor = item.actor?.username
      ? `@${item.actor.username}`
      : locale === "ko"
        ? "누군가"
        : "một người nào đó";
    return t(key, { actor });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("notifications.description")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || items.every((i) => i.isRead)}
          onClick={markAll}
        >
          {t("notifications.markAllRead")}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openItem(item)}
              className={cn(
                "flex w-full gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                item.isRead
                  ? "border-border/50 bg-card/40 hover:bg-muted/40"
                  : "border-[color-mix(in_oklch,var(--brand)_35%,transparent)] bg-[color-mix(in_oklch,var(--brand)_6%,transparent)] hover:bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
              )}
            >
              <UserAvatar
                username={item.actor?.username}
                image={item.actor?.image}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{titleFor(item)}</p>
                {item.body ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {item.body}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  <RelativeTime value={item.createdAt} />
                </p>
              </div>
              {!item.isRead ? (
                <span
                  className="mt-1 size-2 shrink-0 rounded-full bg-[var(--brand)]"
                  aria-label={t("notifications.unread")}
                />
              ) : null}
            </button>
          </li>
        ))}
        {items.length === 0 && !error ? (
          <li className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </li>
        ) : null}
      </ul>

      <p className="text-xs text-muted-foreground">
        {t("notifications.preferDms")}{" "}
        <Link href="/messages" className="text-foreground underline">
          {t("notifications.openMessages")}
        </Link>
      </p>
    </div>
  );
}
