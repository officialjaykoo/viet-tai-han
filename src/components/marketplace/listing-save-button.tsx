"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function ListingSaveButton({
  listingId,
  initialSaved,
  authenticated,
}: {
  listingId: string;
  initialSaved: boolean;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!authenticated) {
      router.push(
        `/login?next=${encodeURIComponent(`/marketplace/${listingId}`)}`
      );
      return;
    }

    setError(null);
    const previous = saved;
    setSaved(!previous);
    startTransition(async () => {
      const res = await apiFetch(`/api/listings/${listingId}/save`, {
        method: "POST",
      });
      if (res.status === 401) {
        setSaved(previous);
        router.push(
          `/login?next=${encodeURIComponent(`/marketplace/${listingId}`)}`
        );
        return;
      }
      if (!res.ok) {
        setSaved(previous);
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("marketplace.saveFailed")));
        return;
      }
      const data = (await res.json()) as { saved?: boolean };
      setSaved(Boolean(data.saved));
      router.refresh();
    });
  }

  if (!authenticated) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/marketplace/${listingId}`)}`}
        className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
      >
        {t("marketplace.loginToSave")}
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="sm"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
      >
        {saved ? t("marketplace.savedAction") : t("marketplace.save")}
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
