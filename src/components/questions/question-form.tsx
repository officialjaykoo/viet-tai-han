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
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

export type QuestionCommunityOption = {
  name: string;
  title: string;
};

export function QuestionForm({
  communities,
}: {
  communities: QuestionCommunityOption[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [community, setCommunity] = useState(communities[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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

    if (!community) {
      setError(t("questions.chooseCommunity"));
      return;
    }

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const res = await apiFetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bot.attachToPayload({ community, title, body })
        ),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/ask")}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("questions.createFailed")));
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/questions/${data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="relative space-y-5"
      data-hydrated={hydrated}
    >
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <div className="space-y-2">
        <label htmlFor="question-community" className="text-sm font-medium">
          {t("questions.community")}
        </label>
        <select
          id="question-community"
          value={community}
          onChange={(event) => setCommunity(event.target.value)}
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
          disabled={pending || communities.length === 0}
        >
          {communities.length === 0 ? (
            <option value="">{t("questions.noCommunities")}</option>
          ) : (
            communities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} — {item.title}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="question-title" className="text-sm font-medium">
          {t("questions.title")}
        </label>
        <Input
          id="question-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("questions.titlePlaceholder")}
          maxLength={300}
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="question-body" className="text-sm font-medium">
          {t("questions.details")}
        </label>
        <Textarea
          id="question-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("questions.detailsPlaceholder")}
          rows={8}
          maxLength={10_000}
          required
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          {t("questions.detailsHint")}
        </p>
      </div>

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
          !community ||
          !title.trim() ||
          !body.trim() ||
          requiresTurnstileToken(turnstileToken)
        }
      >
        {pending ? t("questions.asking") : t("questions.ask")}
      </Button>
    </form>
  );
}
