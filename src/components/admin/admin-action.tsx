"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { apiFetch } from "@/lib/api-client";

export function useAdminAction() {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(op: string, payload: Record<string, unknown> = {}) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await apiFetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(localizeError(data?.error, t("common.error")));
        return;
      }
      setMessage(t("admin.saved"));
      router.refresh();
    });
  }

  return { pending, error, message, run };
}

export function AdminFeedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <div aria-live="polite" className="space-y-1 text-sm">
      {error ? <p className="text-destructive">{error}</p> : null}
      {message ? <p className="text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </div>
  );
}
