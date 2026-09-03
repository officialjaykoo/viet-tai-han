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
import { Textarea } from "@/components/ui/textarea";
import type { BusinessVerification } from "@/lib/businesses";
import { apiFetch } from "@/lib/api-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

export function BusinessVerificationForm({
  businessId,
  latestVerification,
}: {
  businessId: string;
  latestVerification: BusinessVerification | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [evidence, setEvidence] = useState("");
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
      const res = await apiFetch(`/api/businesses/${businessId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bot.attachToPayload({ evidence })),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/businesses/${businessId}`)}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("business.verificationFailed")));
        return;
      }
      router.refresh();
    });
  }

  if (latestVerification?.status === "pending") {
    return (
      <section className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <h2 className="font-heading text-lg font-semibold">{t("business.verificationTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("business.verificationPending")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
      <h2 className="font-heading text-lg font-semibold">{t("business.verificationTitle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {latestVerification?.status === "rejected"
          ? t("business.verificationRejected")
          : t("business.verificationHint")}
      </p>
      {latestVerification?.resolutionNote ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("business.verificationResolution")}:</span>{" "}
          {latestVerification.resolutionNote}
        </p>
      ) : null}
      <form onSubmit={submit} className="relative mt-4 space-y-3" data-hydrated={hydrated}>
        <ParserTraps setTrapRef={bot.setTrapRef} />
        <label htmlFor="business-verification-evidence" className="text-sm font-medium">
          {t("business.evidence")}
        </label>
        <Textarea
          id="business-verification-evidence"
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          placeholder={t("business.evidencePlaceholder")}
          maxLength={2_000}
          minLength={20}
          rows={5}
          required
          disabled={pending}
        />
        <TurnstileWidget onToken={setTurnstileToken} resetRef={turnstileReset} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={
            !hydrated || pending || evidence.trim().length < 20 || requiresTurnstileToken(turnstileToken)
          }
        >
          {pending ? t("business.verificationSubmitting") : t("business.submitVerification")}
        </Button>
      </form>
    </section>
  );
}
