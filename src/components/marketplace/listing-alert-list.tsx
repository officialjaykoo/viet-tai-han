"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { ListingAlert } from "@/lib/marketplace";

export function ListingAlertList({ initialAlerts }: { initialAlerts: ListingAlert[] }) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kindLabels = {
    market: t("marketplace.market"),
    job: t("marketplace.job"),
    service: t("marketplace.service"),
  } as const;

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await apiFetch("/api/listing-alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("common.error")));
        setPendingId(null);
        return;
      }
      setAlerts((current) => current.filter((alert) => alert.id !== id));
      setPendingId(null);
    });
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("marketplace.noAlerts")}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-medium">
                {alert.query || t("marketplace.allKinds")}
              </p>
              <p className="text-xs text-muted-foreground">
                {alert.kind ? kindLabels[alert.kind] : t("marketplace.allKinds")}
                {alert.category ? ` · ${alert.category}` : ""}
                {alert.location ? ` · ${alert.location}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => remove(alert.id)}
              disabled={pending || pendingId === alert.id}
            >
              {t("marketplace.deleteAlert")}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
