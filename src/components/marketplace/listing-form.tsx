"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { LISTING_KINDS, type ListingKind } from "@/lib/marketplace-constants";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

export function ListingForm() {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [kind, setKind] = useState<ListingKind>("market");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    bot.markTrusted(event);
    setError(null);

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const res = await apiFetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bot.attachToPayload({
            kind,
            category,
            title,
            body,
            price: price.trim() || null,
            location,
          })
        ),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/marketplace/new")}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("marketplace.createFailed")));
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/marketplace/${data.id}`);
      router.refresh();
    });
  }

  const kindLabels: Record<ListingKind, string> = {
    market: t("marketplace.market"),
    job: t("marketplace.job"),
    service: t("marketplace.service"),
  };

  return (
    <form
      onSubmit={submit}
      className="relative space-y-5"
      data-hydrated={hydrated}
    >
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <div className="space-y-2">
        <label htmlFor="listing-kind" className="text-sm font-medium">
          {t("marketplace.kind")}
        </label>
        <select
          id="listing-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as ListingKind)}
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
          disabled={pending}
        >
          {LISTING_KINDS.map((value) => (
            <option key={value} value={value}>
              {kindLabels[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="listing-category" className="text-sm font-medium">
            {t("marketplace.category")}
          </label>
          <Input
            id="listing-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t("marketplace.categoryPlaceholder")}
            maxLength={80}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="listing-location" className="text-sm font-medium">
            {t("marketplace.location")}
          </label>
          <Input
            id="listing-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t("marketplace.locationPlaceholder")}
            maxLength={100}
            required
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="listing-title" className="text-sm font-medium">
          {t("marketplace.title")}
        </label>
        <Input
          id="listing-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("marketplace.titlePlaceholder")}
          maxLength={200}
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="listing-body" className="text-sm font-medium">
          {t("marketplace.details")}
        </label>
        <Textarea
          id="listing-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("marketplace.detailsPlaceholder")}
          rows={8}
          maxLength={10_000}
          required
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          {t("marketplace.detailsHint")}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="listing-price" className="text-sm font-medium">
          {t("marketplace.price")}
        </label>
        <Input
          id="listing-price"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder={t("marketplace.pricePlaceholder")}
          maxLength={80}
          disabled={pending}
        />
      </div>

      <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("marketplace.contactPolicy")}
      </p>

      <TurnstileWidget
        onToken={setTurnstileToken}
        resetRef={turnstileReset}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={
          !hydrated ||
          pending ||
          !category.trim() ||
          !title.trim() ||
          !body.trim() ||
          !location.trim() ||
          requiresTurnstileToken(turnstileToken)
        }
      >
        {pending ? t("marketplace.posting") : t("marketplace.post")}
      </Button>
    </form>
  );
}