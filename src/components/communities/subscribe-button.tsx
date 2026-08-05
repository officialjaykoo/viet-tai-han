"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function SubscribeButton({
  name,
  initialSubscribed = false,
  initialCount,
}: {
  name: string;
  initialSubscribed?: boolean;
  initialCount?: number;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/subreddits/${name}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/r/${name}`)}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Couldn't update membership"));
        return;
      }
      const data = (await res.json()) as {
        subscribed: boolean;
        subscriberCount?: number;
      };
      setSubscribed(data.subscribed);
      if (typeof data.subscriberCount === "number") {
        setCount(data.subscriberCount);
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={subscribed ? "outline" : "default"}
          disabled={pending}
          onClick={toggle}
        >
          {subscribed ? t("communities.joined") : t("communities.join")}
        </Button>
        {typeof count === "number" ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {count.toLocaleString()}{" "}
            {count === 1 ? t("communities.member") : t("communities.members")}
          </span>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
