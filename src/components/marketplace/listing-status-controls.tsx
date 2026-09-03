"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { ListingStatus } from "@/lib/marketplace";

export function ListingStatusControls({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ListingStatus | null>(null);
  const [pending, startTransition] = useTransition();

  function update(nextStatus: Exclude<ListingStatus, "removed">) {
    setError(null);
    setPendingStatus(nextStatus);
    startTransition(async () => {
      const res = await apiFetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("marketplace.statusFailed")));
        setPendingStatus(null);
        return;
      }
      setPendingStatus(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("marketplace.statusActions")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={status === "active" ? "secondary" : "outline"}
          onClick={() => update("active")}
          disabled={pending || status === "active"}
        >
          {t("marketplace.markActive")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => update("sold")}
          disabled={pending || status === "sold"}
        >
          {pendingStatus === "sold" ? t("common.loading") : t("marketplace.markSold")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => update("closed")}
          disabled={pending || status === "closed"}
        >
          {pendingStatus === "closed" ? t("common.loading") : t("marketplace.markClosed")}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
