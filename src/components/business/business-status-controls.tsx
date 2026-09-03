"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { BusinessStatus } from "@/lib/business-constants";

export function BusinessStatusControls({
  businessId,
  status,
}: {
  businessId: string;
  status: BusinessStatus;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(nextStatus: "active" | "paused") {
    if (nextStatus === status) return;
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("business.createFailed")));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
      <h2 className="font-heading text-lg font-semibold">{t("business.manage")}</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={status === "active" ? "default" : "outline"}
          disabled={pending || status === "active"}
          onClick={() => update("active")}
        >
          {t("business.active")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={status === "paused" ? "default" : "outline"}
          disabled={pending || status === "paused"}
          onClick={() => update("paused")}
        >
          {t("business.paused")}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
