"use client";

import { useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { SettingsCard, Field } from "@/components/settings/settings-shared";
import {
  settingsErrorMessage,
  settingsRequest,
} from "@/components/settings/settings-action";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import type {
  SettingsChange,
  SettingsFeedback,
} from "@/components/settings/profile-settings";
import type { UserSettings } from "@/lib/user-settings";

const LANGUAGE_LABEL_KEYS = {
  vi: "language.vietnamese",
  ko: "language.korean",
  en: "language.english",
} as const;

const THEME_LABEL_KEYS = {
  system: "settings.themeSystem",
  light: "settings.themeLight",
  dark: "settings.themeDark",
} as const;

type PreferencePatch = Partial<{
  theme: "system" | "light" | "dark";
  preferredLanguage: Locale;
}>;

export function AppearanceSettings({
  onSettingsChange,
  flash,
}: {
  settings: UserSettings;
  onSettingsChange: SettingsChange;
  flash: SettingsFeedback;
}) {
  const { t, setLanguage, locale } = useI18n();
  const localizeError = useLocalizedError();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  function savePreferences(patch: PreferencePatch) {
    const nextTheme = patch.theme;
    const nextLanguage = patch.preferredLanguage;
    flash(null, null);
    startTransition(async () => {
      try {
        const data = await settingsRequest<{ settings?: UserSettings }>(
          "/api/me/settings",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: "preferences", ...patch }),
          },
          t("settings.saveFailed")
        );
        if (!data.settings) throw new Error(t("settings.saveFailed"));
        onSettingsChange(data.settings);
        if (nextTheme) setTheme(data.settings.theme);
        if (nextLanguage) await setLanguage(data.settings.preferredLanguage as Locale);
        flash(t("settings.saved"), null);
      } catch (cause) {
        flash(null, settingsErrorMessage(cause, localizeError, t("settings.saveFailed")));
      }
    });
  }

  return (
    <SettingsCard
      title={t("settings.appearance")}
      description={t("settings.appearanceDesc")}
    >
      <Field label={t("settings.theme")}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(THEME_LABEL_KEYS) as Array<keyof typeof THEME_LABEL_KEYS>).map(
            (value) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => savePreferences({ theme: value })}
                className={cn(
                  "min-h-10 rounded-xl border px-3 text-sm font-medium",
                  theme === value
                    ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                    : "border-border/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {t(THEME_LABEL_KEYS[value])}
              </button>
            )
          )}
        </div>
      </Field>

      <Field label={t("language.settingsLabel")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              disabled={pending}
              onClick={() => savePreferences({ preferredLanguage: code })}
              className={cn(
                "min-h-10 rounded-xl border px-3 text-sm font-medium",
                locale === code
                  ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                  : "border-border/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {t(LANGUAGE_LABEL_KEYS[code])}
            </button>
          ))}
        </div>
      </Field>
    </SettingsCard>
  );
}
