"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-client";

type ProfileActionsProps = {
  username: string;
  initiallyFollowing: boolean;
  initiallyBlocked: boolean;
  showMessage?: boolean;
};

export function ProfileActions({
  username,
  initiallyFollowing,
  initiallyBlocked,
  showMessage = true,
}: ProfileActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: "follow" | "unfollow" | "block" | "unblock") {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 401) {
        router.push(
          `/login?next=${encodeURIComponent(`/u/${username}`)}`
        );
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Action failed"));
        return;
      }
      if (action === "follow") setFollowing(true);
      if (action === "unfollow") setFollowing(false);
      if (action === "block") {
        setBlocked(true);
        setFollowing(false);
      }
      if (action === "unblock") setBlocked(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showMessage && !blocked ? (
        <Link
          href={`/messages?to=${encodeURIComponent(username)}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "min-h-11 sm:min-h-8"
          )}
        >
          {t("profile.message")}
        </Link>
      ) : null}
      {!blocked ? (
        <Button
          type="button"
          size="sm"
          variant={following ? "outline" : "default"}
          className="min-h-11 sm:min-h-8"
          disabled={pending}
          onClick={() => run(following ? "unfollow" : "follow")}
        >
          {following ? t("profile.unfollow") : t("profile.follow")}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={blocked ? "secondary" : "outline"}
        className="min-h-11 sm:min-h-8"
        disabled={pending}
        onClick={() => run(blocked ? "unblock" : "block")}
      >
        {blocked ? t("settings.unblock") : t("profile.block")}
      </Button>
      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
