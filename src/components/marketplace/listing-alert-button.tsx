"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { ListingKind } from "@/lib/marketplace";

export function ListingAlertButton({
  query,
  kind,
  category,
  location,
}: {
  query?: string | null;
  kind?: ListingKind | null;
  category?: string | null;
  location?: string | null;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveAlert() {
    if (![query, kind, category, location].some((value) => value?.trim())) {
      setError(t("marketplace.alertNeedsFilter"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await apiFetch("/api/listing-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, kind, category, location }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("marketplace.alertFailed")));
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={saveAlert}
        disabled={pending || saved}
      >
        {saved ? t("marketplace.alertSaved") : t("marketplace.alertSave")}
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
