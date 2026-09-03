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
import { apiFetch } from "@/lib/api-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

export function AnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
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

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const res = await apiFetch(`/api/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bot.attachToPayload({ body })),
      });
      if (res.status === 401) {
        router.push(
          `/login?next=${encodeURIComponent(`/questions/${questionId}`)}`
        );
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("questions.answerFailed")));
        return;
      }

      setBody("");
      turnstileReset.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="relative space-y-3"
      data-hydrated={hydrated}
    >
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("questions.answerPlaceholder")}
        rows={6}
        maxLength={10_000}
        required
        disabled={pending}
        aria-label={t("questions.answer")}
      />
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
          !body.trim() ||
          requiresTurnstileToken(turnstileToken)
        }
      >
        {pending ? t("questions.answering") : t("questions.postAnswer")}
      </Button>
    </form>
  );
}
