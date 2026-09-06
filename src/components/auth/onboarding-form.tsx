"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { OnboardingState } from "@/lib/onboarding";
import { createUsernameCandidate } from "@/lib/username";

const LANGUAGE_LABEL_KEYS: Record<Locale, MessageKey> = {
  vi: "language.vietnamese",
  ko: "language.korean",
  en: "language.english",
  ru: "language.russian",
};

export function OnboardingForm({ state }: { state: OnboardingState }) {
  const router = useRouter();
  const { locale, setLanguage, t } = useI18n();
  const localizeError = useLocalizedError();
  const [name, setName] = useState(state.name);
  const [username, setUsername] = useState(
    state.onboardingUsernameCandidate ??
      createUsernameCandidate({ displayName: state.name })
  );
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>(
    isLocale(state.preferredLanguage) ? state.preferredLanguage : locale
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await apiFetch("/api/me/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, preferredLanguage }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(
          localizeError(data?.error, t("onboarding.saveFailed"))
        );
        return;
      }

      await setLanguage(preferredLanguage);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <AuthShell>
      <div
        data-hydrated="true"
        className="w-full rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_24px_80px_-28px_rgb(27_24_20_/_35%)] ring-1 ring-white/60 dark:ring-white/5 sm:p-8"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
            {t("onboarding.eyebrow")}
          </p>
          <h1 className="font-heading text-2xl tracking-tight sm:text-[1.7rem]">
            {t("onboarding.title")}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("onboarding.description")}
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {error ? (
            <p
              className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <label className="grid gap-2 text-sm font-medium" htmlFor="onboarding-name">
            {t("onboarding.name")}
            <Input
              id="onboarding-name"
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="onboarding-username"
          >
            {t("onboarding.username")}
            <Input
              id="onboarding-username"
              value={username}
              maxLength={24}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <span className="text-xs font-normal text-muted-foreground">
              {t("onboarding.usernameHint")}
            </span>
          </label>

          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="onboarding-language"
          >
            {t("onboarding.language")}
            <select
              id="onboarding-language"
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value as Locale)}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LOCALES.map((language) => (
                <option key={language} value={language}>
                  {t(LANGUAGE_LABEL_KEYS[language])}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" className="min-h-11 w-full" disabled={pending}>
            {pending ? t("onboarding.saving") : t("onboarding.start")}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
