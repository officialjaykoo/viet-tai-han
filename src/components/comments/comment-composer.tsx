"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

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

export function CommentComposer({ postId }: { postId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();

  function submit(event?: React.MouseEvent | React.FormEvent) {
    if (event) bot.markTrusted(event);
    setError(null);

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const res = await apiFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bot.attachToPayload({ body })),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/post/${postId}`)}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Could not post comment"));
        return;
      }
      setBody("");
      turnstileReset.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="relative space-y-2">
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("comments.placeholder")}
        rows={4}
        aria-label={t("comments.comment")}
      />
      <TurnstileWidget
        onToken={setTurnstileToken}
        resetRef={turnstileReset}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={
          pending || !body.trim() || requiresTurnstileToken(turnstileToken)
        }
        onClick={submit}
      >
        {t("comments.comment")}
      </Button>
    </div>
  );
}
