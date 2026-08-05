"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

export function LanguagePrompt() {
  const { showPrompt, setLanguage, t } = useI18n();

  if (!showPrompt) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-prompt-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-background p-6 shadow-2xl sm:p-8">
        <div className="space-y-3 text-center">
          <p
            id="language-prompt-title"
            className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          >
            {t("language.promptEn")}
          </p>
          <p className="font-heading text-lg text-muted-foreground sm:text-xl">
            {t("language.promptRu")}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="min-h-12 flex-1 rounded-2xl"
            onClick={() => {
              void setLanguage("en");
            }}
          >
            {t("language.preferEnglish")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1 rounded-2xl border-[color-mix(in_oklch,var(--brand)_40%,transparent)]"
            onClick={() => {
              void setLanguage("ru");
            }}
          >
            {t("language.preferRussian")}
          </Button>
        </div>
      </div>
    </div>
  );
}
