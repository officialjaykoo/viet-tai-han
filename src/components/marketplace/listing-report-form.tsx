"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import {
  LISTING_REPORT_REASONS,
  type ListingReportReason,
} from "@/lib/marketplace-constants";

function reasonLabel(
  reason: ListingReportReason,
  t: (key: "marketplace.reasonScam" | "marketplace.reasonProhibited" | "marketplace.reasonMisleading" | "marketplace.reasonUnsafe" | "marketplace.reasonOther") => string
) {
  switch (reason) {
    case "scam":
      return t("marketplace.reasonScam");
    case "prohibited":
      return t("marketplace.reasonProhibited");
    case "misleading":
      return t("marketplace.reasonMisleading");
    case "unsafe":
      return t("marketplace.reasonUnsafe");
    case "other":
      return t("marketplace.reasonOther");
  }
}

export function ListingReportForm({
  listingId,
  authenticated,
}: {
  listingId: string;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ListingReportReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError(t("marketplace.chooseReportReason"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/listings/${listingId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || null }),
      });
      if (res.status === 401) {
        router.push(
          `/login?next=${encodeURIComponent(`/marketplace/${listingId}`)}`
        );
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("marketplace.reportFailed")));
        return;
      }
      setSubmitted(true);
      setOpen(false);
      setDetails("");
      setReason("");
    });
  }

  if (!authenticated) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/marketplace/${listingId}`)}`}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("marketplace.loginToReport")}
      </Link>
    );
  }

  if (submitted) {
    return (
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        {t("marketplace.reportSubmitted")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {t("marketplace.report")}
      </Button>
      {open ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
          <h3 className="text-sm font-semibold">{t("marketplace.reportTitle")}</h3>
          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as ListingReportReason | "")
            }
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            disabled={pending}
            required
          >
            <option value="">{t("marketplace.chooseReportReason")}</option>
            {LISTING_REPORT_REASONS.map((value) => (
              <option key={value} value={value}>
                {reasonLabel(value, t)}
              </option>
            ))}
          </select>
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={t("marketplace.reportDetailsPlaceholder")}
            maxLength={500}
            rows={4}
            disabled={pending}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={pending || !reason}>
            {pending ? t("common.loading") : t("marketplace.reportSubmit")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
