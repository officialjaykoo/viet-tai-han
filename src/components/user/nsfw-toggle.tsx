"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch, apiJson } from "@/lib/api-client";

export function NsfwToggle({ initiallyNsfw }: { initiallyNsfw: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [isNsfw, setIsNsfw] = useState(initiallyNsfw);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = !isNsfw;
    startTransition(async () => {
      const res = await apiFetch("/api/me/nsfw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNsfw: next }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          localizeError(payload?.error, "Could not update NSFW setting")
        );
        return;
      }
      setIsNsfw(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant={isNsfw ? "destructive" : "outline"}
        className="min-h-11 sm:min-h-8"
        disabled={pending}
        onClick={toggle}
      >
        {isNsfw ? t("profile.nsfwOn") : t("profile.nsfwOff")}
      </Button>
      <p className="max-w-sm text-xs text-muted-foreground">
        {t("profile.nsfwHint")}
      </p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
