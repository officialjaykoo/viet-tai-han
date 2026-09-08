"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";

import { AvatarEditor } from "@/components/user/avatar-editor";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { settingsErrorMessage, settingsRequest } from "@/components/settings/settings-action";
import { Field, SettingsCard } from "@/components/settings/settings-shared";
import { validateUsername, usernameCooldownEndsAt } from "@/lib/username";
import type { UserSettings } from "@/lib/user-settings";
import { authClient } from "@/lib/auth-client";

export type SettingsFeedback = (
  message: string | null,
  error: string | null
) => void;

export type SettingsChange = (
  settings: UserSettings | ((current: UserSettings) => UserSettings)
) => void;

type ProfilePatch = {
  username?: string;
  name?: string;
  bio?: string | null;
};

export function ProfileSettings({
  settings,
  onSettingsChange,
  onAvatarSaved,
  flash,
}: {
  settings: UserSettings;
  onSettingsChange: SettingsChange;
  onAvatarSaved: (image: string | null) => void;
  flash: SettingsFeedback;
}) {
  const { t, locale } = useI18n();
  const localizeError = useLocalizedError();
  const router = useRouter();
  const [name, setName] = useState(settings.name);
  const [usernameInput, setUsernameInput] = useState(settings.username ?? "");
  const [bio, setBio] = useState(settings.bio ?? "");
  const [pending, startTransition] = useTransition();
  const [confirmingUsernameChange, setConfirmingUsernameChange] = useState(false);
  const [now, setNow] = useState(0);
  const saveTrigger = useRef<HTMLButtonElement>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const confirmTrigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeConfirmation = useCallback(() => {
    setConfirmingUsernameChange(false);
    window.setTimeout(() => {
      (previousFocus.current ?? saveTrigger.current)?.focus();
      previousFocus.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    const expiry = usernameCooldownEndsAt(settings.usernameChangedAt);
    const immediate = window.setTimeout(() => setNow(Date.now()), 0);
    if (!expiry) return () => window.clearTimeout(immediate);

    const delay = Math.max(0, expiry.getTime() - Date.now() + 25);
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, 2_147_483_647)
    );
    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(timer);
    };
  }, [settings.usernameChangedAt]);

  useEffect(() => {
    if (!confirmingUsernameChange) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimer = window.setTimeout(() => {
      cancelTrigger.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmingUsernameChange, closeConfirmation]);

  const username = settings.username ?? "user";
  const currentUsername = settings.username ?? "";
  const normalizedUsernameInput = usernameInput
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  const usernameInputChanged = normalizedUsernameInput !== currentUsername;
  const usernameCooldownEnds = usernameCooldownEndsAt(settings.usernameChangedAt);
  const usernameChangeLocked = Boolean(
    usernameCooldownEnds && now > 0 && usernameCooldownEnds.getTime() > now
  );


  function buildPatch(): ProfilePatch | null {
    const patch: ProfilePatch = {};
    if (usernameInputChanged) {
      const validation = validateUsername(usernameInput);
      if (!validation.ok) {
        flash(
          null,
          localizeError(
            "Username must be 3–24 letters, numbers, or underscores",
            t("settings.usernameSaveFailed")
          )
        );
        return null;
      }
      patch.username = validation.username;
    }

    const nextName = name.trim().slice(0, 80);
    const nextBio = bio.trim().slice(0, 300) || null;
    if (nextName !== settings.name) patch.name = nextName;
    if (nextBio !== (settings.bio ?? null)) patch.bio = nextBio;
    return Object.keys(patch).length ? patch : null;
  }

  function submitProfile(patch: ProfilePatch, closeAfterSuccess: boolean) {
    flash(null, null);
    startTransition(async () => {
      try {
        const data = await settingsRequest<{ settings?: UserSettings }>(
          "/api/me/profile",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
          t("settings.usernameSaveFailed")
        );
        if (!data.settings) throw new Error(t("settings.usernameSaveFailed"));
        onSettingsChange(data.settings);
        setName(data.settings.name);
        setBio(data.settings.bio ?? "");
        setUsernameInput(data.settings.username ?? "");
        await authClient.getSession().catch(() => undefined);
        router.refresh();
        flash(t("settings.profileSaved"), null);
        if (closeAfterSuccess) closeConfirmation();
      } catch (cause) {
        flash(
          null,
          settingsErrorMessage(
            cause,
            localizeError,
            t("settings.usernameSaveFailed")
          )
        );
      }
    });
  }

  function saveProfile() {
    const patch = buildPatch();
    if (!patch) {
      if (!usernameInputChanged && name === settings.name && bio === (settings.bio ?? "")) {
        flash(t("settings.profileSaved"), null);
      }
      return;
    }
    if (usernameInputChanged && usernameChangeLocked) return;
    if (patch.username) {
      setConfirmingUsernameChange(true);
      return;
    }
    submitProfile(patch, false);
  }

  function confirmUsernameChange() {
    if (pending) return;
    const patch = buildPatch();
    if (!patch?.username) {
      closeConfirmation();
      return;
    }
    submitProfile(patch, true);
  }

  return (
    <SettingsCard
      title={t("settings.customizeProfile")}
      description={t("settings.customizeProfileDesc")}
    >
      <div className="rounded-2xl border border-border/60 p-4">
        <AvatarEditor
          username={username}
          onSaved={onAvatarSaved}
          image={settings.image}
        />
      </div>

      <Field label={t("settings.username")}>
        <Input
          value={usernameInput}
          maxLength={24}
          autoComplete="username"
          onChange={(event) => setUsernameInput(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {usernameChangeLocked && usernameCooldownEnds
            ? t("settings.usernameChangeCooldown", {
                date: usernameCooldownEnds.toLocaleDateString(locale),
              })
            : t("settings.usernameChangeHint")}
        </p>
      </Field>

      <Field label={t("settings.displayName")}>
        <Input
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field label={t("settings.bio")}>
        <Textarea
          value={bio}
          maxLength={300}
          rows={4}
          placeholder={t("settings.bioPlaceholder")}
          onChange={(event) => setBio(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{bio.length}/300</p>
      </Field>

      <Button
        ref={saveTrigger}
        type="button"
        disabled={pending || (usernameChangeLocked && usernameInputChanged)}
        onClick={saveProfile}
        className="min-h-11"
      >
        {pending ? t("settings.saving") : t("settings.saveProfile")}
      </Button>

      {confirmingUsernameChange ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="username-change-title"
          aria-describedby="username-change-details"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-xl">
            <div>
              <h2
                id="username-change-title"
                className="font-heading text-lg font-semibold"
              >
                {t("settings.usernameChangeWarning")}
              </h2>
              <p
                id="username-change-details"
                className="mt-2 whitespace-pre-line text-sm text-muted-foreground"
              >
                {t("settings.usernameChangeDetails", {
                  oldUsername: username,
                  newUsername: normalizedUsernameInput,
                })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                ref={cancelTrigger}
                type="button"
                variant="outline"
                disabled={pending}
                onClick={closeConfirmation}
              >
                {t("common.cancel")}
              </Button>
              <Button
                ref={confirmTrigger}
                type="button"
                disabled={pending}
                onClick={confirmUsernameChange}
              >
                {pending
                  ? t("settings.saving")
                  : t("settings.confirmUsernameChange")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsCard>
  );
}
