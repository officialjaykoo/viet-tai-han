"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { cn } from "@/lib/utils";

const LANGUAGE_LABEL_KEYS: Record<Locale, MessageKey> = {
  vi: "language.vietnamese",
  ko: "language.korean",
  en: "language.english",
  ru: "language.russian",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLanguage, t } = useI18n();

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("language.settingsLabel")}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              void setLanguage(code);
            }}
            className={cn(
              "min-h-10 rounded-xl border px-3 text-sm font-medium transition-colors",
              locale === code
                ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)] text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t(LANGUAGE_LABEL_KEYS[code])}
          </button>
        ))}
      </div>
    </div>
  );
}
