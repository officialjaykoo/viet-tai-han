"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BellIcon,
  LockIcon,
  PaletteIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";

import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { ConnectedAccountsSettings } from "@/components/settings/connected-accounts-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import {
  PrivacySettings,
  type BlockedUser,
  type MutedUser,
} from "@/components/settings/privacy-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import type { PushConfigState } from "@/lib/push";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { UserSettings } from "@/lib/user-settings";
import type { OAuthProviderCapabilities } from "@/lib/oauth-providers";
import { cn } from "@/lib/utils";

type Section =
  | "profile"
  | "account"
  | "appearance"
  | "privacy"
  | "notifications";

const SECTIONS: { id: Section; labelKey: MessageKey; icon: ReactNode }[] = [
  {
    id: "profile",
    labelKey: "settings.sectionProfile",
    icon: <UserIcon className="size-4" />,
  },
  {
    id: "account",
    labelKey: "settings.sectionAccount",
    icon: <LockIcon className="size-4" />,
  },
  {
    id: "appearance",
    labelKey: "settings.sectionAppearance",
    icon: <PaletteIcon className="size-4" />,
  },
  {
    id: "privacy",
    labelKey: "settings.sectionPrivacy",
    icon: <ShieldIcon className="size-4" />,
  },
  {
    id: "notifications",
    labelKey: "settings.sectionNotifications",
    icon: <BellIcon className="size-4" />,
  },
];

export function SettingsClient({
  initialSettings,
  initialBlocked,
  initialMuted,
  initialSection = "profile",
  initialPush,
  initialIdentityError,
  oauthProviders,
}: {
  initialSettings: UserSettings;
  initialBlocked: BlockedUser[];
  initialMuted: MutedUser[];
  initialSection?: Section;
  initialPush: {
    available: boolean;
    configuration: PushConfigState;
    publicKey: string | null;
    currentDeviceSubscribed: boolean;
    activeDeviceCount: number;
    hasAnySubscription: boolean;
  };
  initialIdentityError?: string;
  oauthProviders: OAuthProviderCapabilities;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [section, setSection] = useState<Section>(initialSection);
  const [settings, setSettings] = useState(initialSettings);
  const [blocked, setBlocked] = useState(initialBlocked);
  const shellRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    initialIdentityError
      ? localizeError(initialIdentityError, t("settings.linkFailed"))
      : null
  );

  const flash = useCallback(
    (nextMessage: string | null, nextError: string | null) => {
      setMessage(nextMessage);
      setError(nextError);
    },
    []
  );
  useEffect(() => {
    shellRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url.toString());
  }, [section]);

  return (
    <div
      ref={shellRef}
      className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]"
    >
      <nav
        className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
        aria-label={t("settings.navAria")}
      >
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
              section === item.id
                ? "bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        {(message || error) && (
          <p
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              error
                ? "border-destructive/40 text-destructive"
                : "border-border/60 text-muted-foreground"
            )}
            role={error ? "alert" : "status"}
          >
            {error ?? message}
          </p>
        )}

        {section === "profile" ? (
          <ProfileSettings
            settings={settings}
            onSettingsChange={setSettings}
            onAvatarSaved={(image) =>
              setSettings((current) => ({ ...current, image }))
            }
            flash={flash}
          />
        ) : null}

        {section === "account" ? (
          <>
            <AccountSettings
              settings={settings}
              onSettingsChange={setSettings}
              flash={flash}
            />
            <ConnectedAccountsSettings
              capabilities={oauthProviders}
              flash={flash}
            />
          </>
        ) : null}

        {section === "appearance" ? (
          <AppearanceSettings
            settings={settings}
            onSettingsChange={setSettings}
            flash={flash}
          />
        ) : null}

        {section === "privacy" ? (
          <PrivacySettings
            settings={settings}
            initialBlocked={blocked}
            initialMuted={initialMuted}
            onSettingsChange={setSettings}
            onBlockedChange={setBlocked}
            flash={flash}
          />
        ) : null}

        {section === "notifications" ? (
          <NotificationSettings
            settings={settings}
            initialPush={initialPush}
            onSettingsChange={setSettings}
            flash={flash}
          />
        ) : null}

      </div>
    </div>
  );
}
