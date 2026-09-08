"use client";

import { useTransition } from "react";

import { PushSettings } from "@/components/notifications/push-settings";
import { SettingsCard, ToggleRow } from "@/components/settings/settings-shared";
import { settingsErrorMessage, settingsRequest } from "@/components/settings/settings-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import type { PushConfigState } from "@/lib/push";
import type {
  SettingsChange,
  SettingsFeedback,
} from "@/components/settings/profile-settings";
import type { UserSettings } from "@/lib/user-settings";

export function NotificationSettings({
  settings,
  initialPush,
  onSettingsChange,
  flash,
}: {
  settings: UserSettings;
  initialPush: {
    available: boolean;
    configuration: PushConfigState;
    publicKey: string | null;
    currentDeviceSubscribed: boolean;
    activeDeviceCount: number;
    hasAnySubscription: boolean;
  };
  onSettingsChange: SettingsChange;
  flash: SettingsFeedback;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();

  function savePreferences(
    patch: Partial<
      Pick<
        UserSettings,
        "notifyComments" | "notifyFollows" | "notifyChat" | "notifyMentions"
      >
    >
  ) {
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
        flash(t("settings.saved"), null);
      } catch (cause) {
        flash(null, settingsErrorMessage(cause, localizeError, t("settings.saveFailed")));
      }
    });
  }

  return (
    <>
      <SettingsCard
        title={t("settings.notifyPrefs")}
        description={t("settings.notifyPrefsDesc")}
      >
        <ToggleRow
          label={t("settings.notifyComments")}
          checked={settings.notifyComments}
          disabled={pending}
          onChange={(next) => savePreferences({ notifyComments: next })}
        />
        <ToggleRow
          label={t("settings.notifyFollows")}
          checked={settings.notifyFollows}
          disabled={pending}
          onChange={(next) => savePreferences({ notifyFollows: next })}
        />
        <ToggleRow
          label={t("settings.notifyChat")}
          checked={settings.notifyChat}
          disabled={pending}
          onChange={(next) => savePreferences({ notifyChat: next })}
        />
        <ToggleRow
          label={t("settings.notifyMentions")}
          checked={settings.notifyMentions}
          disabled={pending}
          onChange={(next) => savePreferences({ notifyMentions: next })}
        />
      </SettingsCard>
      <PushSettings
        available={initialPush.available}
        configuration={initialPush.configuration}
        publicKey={initialPush.publicKey}
        initialCurrentDeviceSubscribed={initialPush.currentDeviceSubscribed}
        initialActiveDeviceCount={initialPush.activeDeviceCount}
      />
    </>
  );
}
