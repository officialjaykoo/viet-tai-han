"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  BellIcon,
  EyeIcon,
  ImageIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  PaletteIcon,
  ShieldIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { TunneledBanner } from "@/components/media/tunneled-banner";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { authClient } from "@/lib/auth-client";
import { createAvatarSeed, encodeGeneratedAvatar } from "@/lib/avatar";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { profileBannerGradient } from "@/lib/profile-banner";
import type {
  AllowDms,
  ThemePreference,
  UserSettings,
} from "@/lib/user-settings";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type Section = "profile" | "account" | "appearance" | "privacy" | "notifications";

type BlockedUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  blockedAt: string;
};
type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
};

type AccountPasskey = {
  id: string;
  name?: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
};


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
  initialSection = "profile",
  initialIdentityError,
}: {
  initialSettings: UserSettings;
  initialBlocked: BlockedUser[];
  initialSection?: Section;
  initialIdentityError?: string;
}) {
  const router = useRouter();
  const { t, setLanguage, locale } = useI18n();
  const localizeError = useLocalizedError();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<Section>(initialSection);
  const [settings, setSettings] = useState(initialSettings);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    initialIdentityError
      ? localizeError(initialIdentityError, t("settings.linkFailed"))
      : null
  );

  // Profile form
  const [name, setName] = useState(initialSettings.name);
  const [bio, setBio] = useState(initialSettings.bio ?? "");
  const [image, setImage] = useState(initialSettings.image);
  const [bannerKey, setBannerKey] = useState(initialSettings.bannerKey);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  // Account form
  const [email, setEmail] = useState(initialSettings.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [passkeys, setPasskeys] = useState<AccountPasskey[]>([]);
  const [passkeyName, setPasskeyName] = useState("");
  const [identityLoading, setIdentityLoading] = useState(true);

  const username = settings.username ?? "user";
  const bannerGradient = profileBannerGradient(username);

  const flash = useCallback((ok: string | null, err: string | null) => {
    setMessage(ok);
    setError(err);
  }, []);

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.set("file", file);
    const res = await apiFetch("/api/media", { method: "POST", body: form });
    const data = (await res.json()) as { mediaKey?: string; error?: string };
    if (!res.ok || !data.mediaKey) {
      throw new Error(data.error ?? "Upload failed");
    }
    return data.mediaKey;
  }

  function saveProfile() {
    flash(null, null);
    startTransition(async () => {
      const res = await apiFetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "profile",
          name,
          bio,
          image,
          bannerKey,
        }),
      });
      const data = (await res.json()) as {
        settings?: UserSettings;
        error?: string;
      };
      if (!res.ok) {
        flash(null, localizeError(data.error, "Could not save profile"));
        return;
      }
      if (data.settings) setSettings(data.settings);
      flash(t("settings.profileSaved"), null);
      router.refresh();
    });
  }

  function saveEmail() {
    flash(null, null);
    startTransition(async () => {
      const res = await apiFetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "email", email }),
      });
      const data = (await res.json()) as { email?: string; error?: string };
      if (!res.ok) {
        flash(null, localizeError(data.error, "Could not update email"));
        return;
      }
      if (data.email) {
        setEmail(data.email);
        setSettings((s) => ({ ...s, email: data.email! }));
      }
      flash(t("settings.emailUpdated"), null);
    });
  }

  function savePassword() {
    flash(null, null);
    if (newPassword.length < 8) {
      flash(null, localizeError("Password must be at least 8 characters"));
      return;
    }
    if (newPassword !== confirmPassword) {
      flash(null, localizeError("Passwords do not match"));
      return;
    }
    startTransition(async () => {
      const { error: pwError } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (pwError) {
        flash(
          null,
          localizeError(pwError.message, "Could not change password")
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      flash(t("settings.passwordChanged"), null);
    });
  }
  const loadIdentityMethods = useCallback(
    async (showError = true) => {
      const [accountsResult, passkeysResult] = await Promise.all([
        authClient.listAccounts(),
        authClient.passkey.listUserPasskeys(),
      ]);
      setIdentityLoading(false);

      if (accountsResult.data) {
        setLinkedAccounts(accountsResult.data);
      }
      if (passkeysResult.data) {
        setPasskeys(passkeysResult.data);
      }

      const loadError =
        accountsResult.error?.message ?? passkeysResult.error?.message;
      if (showError && loadError) {
        flash(
          null,
          localizeError(loadError, t("settings.identityLoadFailed"))
        );
      }
    },
    [flash, localizeError, t]
  );

  function linkIdentity(provider: "facebook" | "zalo") {
    flash(null, null);
    startTransition(async () => {
      const callbackURL = "/settings?section=account";
      const result =
        provider === "facebook"
          ? await authClient.linkSocial({
              provider: "facebook",
              callbackURL,
              errorCallbackURL: callbackURL,
            })
          : await authClient.oauth2.link({
              providerId: "zalo",
              callbackURL,
              errorCallbackURL: callbackURL,
            });

      if (result.error) {
        flash(
          null,
          localizeError(result.error.message, t("settings.linkFailed"))
        );
      }
    });
  }

  function unlinkIdentity(account: LinkedAccount) {
    flash(null, null);
    startTransition(async () => {
      const result = await authClient.unlinkAccount({
        providerId: account.providerId,
        accountId: account.accountId,
      });
      if (result.error) {
        flash(
          null,
          localizeError(result.error.message, t("settings.unlinkFailed"))
        );
        return;
      }
      await loadIdentityMethods(false);
      flash(t("settings.accountUnlinked"), null);
    });
  }

  function addPasskey() {
    flash(null, null);
    if (!window.PublicKeyCredential) {
      flash(null, t("settings.passkeyUnsupported"));
      return;
    }

    startTransition(async () => {
      const result = await authClient.passkey.addPasskey({
        name: passkeyName.trim() || undefined,
      });
      if (result.error) {
        flash(
          null,
          localizeError(result.error.message, t("settings.passkeyAddFailed"))
        );
        return;
      }
      setPasskeyName("");
      await loadIdentityMethods(false);
      flash(t("settings.passkeyAdded"), null);
    });
  }

  function deletePasskey(id: string) {
    flash(null, null);
    startTransition(async () => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) {
        flash(
          null,
          localizeError(result.error.message, t("settings.passkeyDeleteFailed"))
        );
        return;
      }
      await loadIdentityMethods(false);
      flash(t("settings.passkeyDeleted"), null);
    });
  }


  function savePreferences(patch: Record<string, unknown>) {
    flash(null, null);
    startTransition(async () => {
      const res = await apiFetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "preferences", ...patch }),
      });
      const data = (await res.json()) as {
        settings?: UserSettings;
        error?: string;
      };
      if (!res.ok) {
        flash(null, localizeError(data.error, "Could not save"));
        return;
      }
      if (data.settings) {
        setSettings(data.settings);
        if (
          data.settings.preferredLanguage === "vi" ||
          data.settings.preferredLanguage === "ko"
        ) {
          void setLanguage(data.settings.preferredLanguage);
        }
        if (
          data.settings.theme === "system" ||
          data.settings.theme === "light" ||
          data.settings.theme === "dark"
        ) {
          setTheme(data.settings.theme);
        }
      }
      flash(t("settings.saved"), null);
      router.refresh();
    });
  }

  function unblock(usernameToUnblock: string) {
    startTransition(async () => {
      await apiFetch(`/api/users/${encodeURIComponent(usernameToUnblock)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock" }),
      });
      setBlocked((list) =>
        list.filter((u) => u.username !== usernameToUnblock)
      );
    });
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.toString());
  }, [section]);
  useEffect(() => {
    if (section !== "account") return;

    let active = true;
    void Promise.all([
      authClient.listAccounts(),
      authClient.passkey.listUserPasskeys(),
    ]).then(([accountsResult, passkeysResult]) => {
      if (!active) return;
      setIdentityLoading(false);
      if (accountsResult.data) setLinkedAccounts(accountsResult.data);
      if (passkeysResult.data) setPasskeys(passkeysResult.data);
    });

    return () => {
      active = false;
    };
  }, [section]);



  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
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
          <SettingsCard
            title={t("settings.customizeProfile")}
            description={t("settings.customizeProfileDesc")}
          >
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <div
                className="relative h-28 bg-muted sm:h-32"
                style={
                  bannerKey
                    ? undefined
                    : {
                        background: `linear-gradient(135deg, ${bannerGradient.from}, ${bannerGradient.to})`,
                      }
                }
              >
                {bannerKey ? <TunneledBanner mediaKey={bannerKey} /> : null}
                <div className="absolute inset-x-0 bottom-2 flex justify-end gap-2 px-3">
                  <input
                    ref={bannerInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      startTransition(async () => {
                        try {
                          const key = await uploadFile(file);
                          setBannerKey(key);
                          flash(null, null);
                        } catch (err) {
                          flash(
                            null,
                            localizeError(
                              err instanceof Error ? err.message : null,
                              "Upload failed"
                            )
                          );
                        }
                      });
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() => bannerInput.current?.click()}
                  >
                    <ImageIcon className="size-3.5" />
                    {t("settings.banner")}
                  </Button>
                  {bannerKey ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setBannerKey(null)}
                    >
                      {t("settings.remove")}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="relative px-4 pb-4 pt-2">
                <div className="-mt-10 inline-block rounded-full bg-background p-1 ring-1 ring-border/60">
                  <UserAvatar
                    username={username}
                    image={image}
                    size="2xl"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      startTransition(async () => {
                        try {
                          const key = await uploadFile(file);
                          setImage(`/api/media/${key}`);
                        } catch (err) {
                          flash(
                            null,
                            localizeError(
                              err instanceof Error ? err.message : null,
                              "Upload failed"
                            )
                          );
                        }
                      });
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => avatarInput.current?.click()}
                  >
                    {t("settings.uploadAvatar")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      setImage(encodeGeneratedAvatar(createAvatarSeed()))
                    }
                  >
                    {t("settings.shuffleAvatar")}
                  </Button>
                </div>
              </div>
            </div>

            <Field label={t("settings.username")}>
              <Input value={`@${username}`} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                {t("settings.usernamePermanent")}
              </p>
            </Field>

            <Field label={t("settings.displayName")}>
              <Input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label={t("settings.bio")}>
              <Textarea
                value={bio}
                maxLength={300}
                rows={4}
                placeholder={t("settings.bioPlaceholder")}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{bio.length}/300</p>
            </Field>

            <Button
              type="button"
              disabled={pending}
              onClick={saveProfile}
              className="min-h-11"
            >
              {pending ? t("settings.saving") : t("settings.saveProfile")}
            </Button>
          </SettingsCard>
        ) : null}

        {section === "account" ? (
          <>
            <SettingsCard
              title={t("settings.emailAddress")}
              description={t("settings.emailAddressDesc")}
            >
              <Field label={t("settings.email")}>
                <Input
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                disabled={pending || email === settings.email}
                onClick={saveEmail}
              >
                {t("settings.updateEmail")}
              </Button>
            </SettingsCard>

            <SettingsCard
              title={t("settings.connectedAccounts")}
              description={t("settings.connectedAccountsDesc")}
            >
              {identityLoading && linkedAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {linkedAccounts.map((account) => (
                    <li
                      key={account.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
                    >
                      <span className="text-sm font-medium capitalize">
                        {account.providerId === "credential"
                          ? t("settings.passwordAccount")
                          : account.providerId}
                      </span>
                      {account.providerId !== "credential" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || identityLoading}
                          onClick={() => unlinkIdentity(account)}
                        >
                          {t("settings.unlink")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    pending ||
                    identityLoading ||
                    linkedAccounts.some(
                      (account) => account.providerId === "facebook"
                    )
                  }
                  onClick={() => linkIdentity("facebook")}
                >
                  <LinkIcon className="size-4" />
                  {t("settings.linkFacebook")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    pending ||
                    identityLoading ||
                    linkedAccounts.some(
                      (account) => account.providerId === "zalo"
                    )
                  }
                  onClick={() => linkIdentity("zalo")}
                >
                  <LinkIcon className="size-4" />
                  {t("settings.linkZalo")}
                </Button>
              </div>
            </SettingsCard>

            <SettingsCard
              title={t("settings.passkeys")}
              description={t("settings.passkeysDesc")}
            >
              {passkeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings.noPasskeys")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {passkeys.map((passkey) => (
                    <li
                      key={passkey.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {passkey.name || t("settings.unnamedPasskey")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(passkey.createdAt).toLocaleDateString(
                            locale
                          )}
                          {" · "}
                          {passkey.deviceType}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={pending || identityLoading}
                        aria-label={t("settings.deletePasskey")}
                        onClick={() => deletePasskey(passkey.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={passkeyName}
                  maxLength={80}
                  placeholder={t("settings.passkeyNamePlaceholder")}
                  onChange={(event) => setPasskeyName(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={pending || identityLoading}
                  onClick={addPasskey}
                  className="shrink-0"
                >
                  <KeyRoundIcon className="size-4" />
                  {t("settings.addPasskey")}
                </Button>
              </div>
            </SettingsCard>

            <SettingsCard
              title={t("settings.password")}
              description={t("settings.passwordDesc")}
            >
              <Field label={t("settings.currentPassword")}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
              <Field label={t("settings.newPassword")}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field label={t("settings.confirmPassword")}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                disabled={pending || !currentPassword || !newPassword}
                onClick={savePassword}
              >
                {t("settings.changePassword")}
              </Button>
            </SettingsCard>
          </>
        ) : null}

        {section === "appearance" ? (
          <SettingsCard
            title={t("settings.appearance")}
            description={t("settings.appearanceDesc")}
          >
            <Field label={t("settings.theme")}>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["system", "settings.themeSystem"],
                    ["light", "settings.themeLight"],
                    ["dark", "settings.themeDark"],
                  ] as const
                ).map(([value, labelKey]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setTheme(value);
                      savePreferences({ theme: value as ThemePreference });
                    }}
                    className={cn(
                      "min-h-10 rounded-xl border px-3 text-sm font-medium",
                      theme === value
                        ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                        : "border-border/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("language.settingsLabel")}>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["vi", t("language.vietnamese")],
                    ["ko", t("language.korean")],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      savePreferences({ preferredLanguage: code });
                    }}
                    className={cn(
                      "min-h-10 rounded-xl border px-3 text-sm font-medium",
                      locale === code
                        ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                        : "border-border/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </SettingsCard>
        ) : null}

        {section === "privacy" ? (
          <>
            <SettingsCard
              title={t("settings.privacy")}
              description={t("settings.privacyDesc")}
            >
              <ToggleRow
                label={t("settings.markNsfw")}
                description={t("settings.markNsfwDesc")}
                checked={settings.isNsfw}
                disabled={pending}
                onChange={(next) => savePreferences({ isNsfw: next })}
              />
              <ToggleRow
                label={t("settings.showNsfw")}
                description={t("settings.showNsfwDesc")}
                checked={settings.showNsfw}
                disabled={pending}
                onChange={(next) => savePreferences({ showNsfw: next })}
                icon={<EyeIcon className="size-4" />}
              />
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
                      onClick={() =>
                        savePreferences({ allowDms: value as AllowDms })
                      }
                      className={cn(
                        "min-h-10 rounded-xl border px-3 text-sm font-medium",
                        settings.allowDms === value
                          ? "border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                          : "border-border/60 text-muted-foreground hover:bg-muted"
                      )}
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
                <p className="text-sm text-muted-foreground">
                  {t("settings.noBlocked")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {blocked.map((user) => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
                    >
                      <Link
                        href={user.username ? `/u/${user.username}` : "#"}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <UserAvatar
                          username={user.username}
                          image={user.image}
                          size="sm"
                        />
                        <span className="truncate text-sm font-medium">
                          @{user.username ?? "unknown"}
                        </span>
                      </Link>
                      {user.username ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => unblock(user.username!)}
                        >
                          {t("settings.unblock")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SettingsCard>
          </>
        ) : null}

        {section === "notifications" ? (
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
        ) : null}
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 px-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--brand)]" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
