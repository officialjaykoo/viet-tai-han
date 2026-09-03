"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLanguage, t } = useI18n();

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("language.settingsLabel")}
      </p>
      <div className="flex gap-2">
        {(["vi", "ko"] as Locale[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              void setLanguage(code);
            }}
            className={cn(
              "min-h-10 flex-1 rounded-xl border px-3 text-sm font-medium transition-colors",
              locale === code
                ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)] text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {code === "vi" ? t("language.vietnamese") : t("language.korean")}
          </button>
        ))}
      </div>
    </div>
  );
}
