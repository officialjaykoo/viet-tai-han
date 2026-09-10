"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { SettingsCard, Field } from "@/components/settings/settings-shared";
import {
  settingsErrorMessage,
  settingsRequest,
} from "@/components/settings/settings-action";
import { UserAvatar } from "@/components/user/user-avatar";
import type {
  SettingsChange,
  SettingsFeedback,
} from "@/components/settings/profile-settings";
import type { AllowDms, UserSettings } from "@/lib/user-settings";

export type BlockedUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  blockedAt: string;
};
export type MutedUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  mutedAt: string;
};

export function PrivacySettings({
  settings,
  initialBlocked,
  initialMuted,
  onSettingsChange,
  onBlockedChange,
  flash,
}: {
  settings: UserSettings;
  initialBlocked: BlockedUser[];
  initialMuted: MutedUser[];
  onSettingsChange: SettingsChange;
  onBlockedChange: (blocked: BlockedUser[]) => void;
  flash: SettingsFeedback;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [pending, startTransition] = useTransition();

  function savePreferences(patch: Partial<Pick<UserSettings, "allowDms">>) {
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


  function unblock(user: BlockedUser) {
    flash(null, null);
    startTransition(async () => {
      try {
        const data = await settingsRequest<{ blocked?: unknown }>(
          `/api/me/blocks/${encodeURIComponent(user.id)}`,
          { method: "DELETE" },
          t("settings.unblockFailed")
        );
        if (data.blocked !== false) throw new Error(t("settings.unblockFailed"));
        setBlocked((current) => current.filter((candidate) => candidate.id !== user.id));
        onBlockedChange(blocked.filter((candidate) => candidate.id !== user.id));
        flash(t("settings.unblocked"), null);
      } catch (cause) {
        flash(
          null,
          settingsErrorMessage(cause, localizeError, t("settings.unblockFailed"))
        );
      }
    });
  }
  function unmute(user: MutedUser) {
    flash(null, null);
    startTransition(async () => {
      try {
        const data = await settingsRequest<{ muteState?: string }>(
          `/api/users/${encodeURIComponent(user.username ?? user.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "unmute" }),
          },
          t("settings.unmuteFailed")
        );
        if (data.muteState !== "none") {
          throw new Error(t("settings.unmuteFailed"));
        }
        setMuted((current) => current.filter((candidate) => candidate.id !== user.id));
        flash(t("settings.unmuted"), null);
      } catch (cause) {
        flash(
          null,
          settingsErrorMessage(cause, localizeError, t("settings.unmuteFailed"))
        );
      }
    });
  }

  return (
    <>
      <SettingsCard
        title={t("settings.privacy")}
        description={t("settings.privacyDesc")}
      >
        <Field label={t("settings.allowDms")}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["anyone", "settings.dmsAnyone"],
                ["followers", "settings.dmsFollowers"],
                ["nobody", "settings.dmsNobody"],
              ] as const
            ).map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => savePreferences({ allowDms: value as AllowDms })}
                className={`min-h-10 rounded-xl border px-3 text-sm font-medium ${
                  settings.allowDms === value
                    ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                    : "border-border/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </Field>
      </SettingsCard>


      <SettingsCard
        title={t("settings.blockedAccounts")}
        description={t("settings.blockedAccountsDesc")}
      >
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.noBlocked")}</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
              >
                {user.username ? (
                  <Link
                    href={`/u/${encodeURIComponent(user.username)}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <UserAvatar username={user.username} image={user.image} size="sm" />
                    <span className="truncate text-sm font-medium">@{user.username}</span>
                  </Link>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar username={null} image={user.image} size="sm" />
                    <span className="truncate text-sm font-medium">
                      {user.name || t("settings.unknownUser")}
                    </span>
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => unblock(user)}
                >
                  {t("settings.unblock")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      <SettingsCard
        title={t("settings.mutedAccounts")}
        description={t("settings.mutedAccountsDesc")}
      >
        {muted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.noMuted")}</p>
        ) : (
          <ul className="space-y-2">
            {muted.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
              >
                {user.username ? (
                  <Link
                    href={`/u/${encodeURIComponent(user.username)}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <UserAvatar username={user.username} image={user.image} size="sm" />
                    <span className="truncate text-sm font-medium">@{user.username}</span>
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">
                    {user.name || t("settings.unknownUser")}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => unmute(user)}
                >
                  {t("settings.unmute")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}
