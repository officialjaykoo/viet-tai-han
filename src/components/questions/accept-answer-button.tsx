"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function AcceptAnswerButton({
  questionId,
  answerId,
  initialAccepted,
}: {
  questionId: string;
  answerId: string;
  initialAccepted: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [accepted, setAccepted] = useState(initialAccepted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/questions/${questionId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
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
        setError(localizeError(payload?.error, t("questions.acceptFailed")));
        return;
      }
      const data = (await res.json()) as { acceptedAnswerId: string | null };
      setAccepted(data.acceptedAnswerId === answerId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={accepted ? "secondary" : "outline"}
        disabled={pending}
        aria-pressed={accepted}
        onClick={toggle}
      >
        <CheckCircle2Icon className="size-4" />
        {accepted ? t("questions.accepted") : t("questions.accept")}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
