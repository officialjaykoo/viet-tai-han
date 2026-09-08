"use client";

import { useState, useTransition } from "react";

import { Field, SettingsCard } from "@/components/settings/settings-shared";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  settingsErrorMessage,
  settingsRequest,
} from "@/components/settings/settings-action";
import type { ProStatus } from "@/lib/monetization";
import type { UserSettings } from "@/lib/user-settings";
import type {
  SettingsChange,
  SettingsFeedback,
} from "@/components/settings/profile-settings";

export function AccountSettings({
  settings,
  initialPro,
  onSettingsChange,
  flash,
}: {
  settings: UserSettings;
  initialPro: ProStatus;
  onSettingsChange: SettingsChange;
  flash: SettingsFeedback;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [contactEmail, setContactEmail] = useState(
    settings.contactEmail ?? ""
  );
  const [pending, startTransition] = useTransition();

  function saveContactEmail() {
    flash(null, null);
    startTransition(async () => {
      try {
        const data = await settingsRequest<{
          contactEmail?: string | null;
          contactEmailVerified?: boolean;
        }>(
          "/api/me/settings",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: "contactEmail", contactEmail }),
          },
          t("settings.contactEmailSaveFailed")
        );
        const contactEmailVerified = data.contactEmailVerified;
        if (
          !("contactEmail" in data) ||
          typeof contactEmailVerified !== "boolean"
        ) {
          throw new Error(t("settings.contactEmailSaveFailed"));
        }
        const nextContactEmail = data.contactEmail ?? "";
        setContactEmail(nextContactEmail);
        onSettingsChange((current) => ({
          ...current,
          contactEmail: data.contactEmail ?? null,
          contactEmailVerified,
        }));
        flash(t("settings.contactEmailUpdated"), null);
      } catch (cause) {
        flash(
          null,
          settingsErrorMessage(
            cause,
            localizeError,
            t("settings.contactEmailSaveFailed")
          )
        );
      }
    });
  }

  return (
    <>
      <SettingsCard
        title={t("settings.pro")}
        description={t("settings.proDescription")}
      >
        <div className="rounded-xl border border-border/50 px-3 py-3">
          <p className="text-sm font-medium">
            {initialPro.active
              ? t("settings.proActive")
              : t("settings.proInactive")}
          </p>
          {initialPro.plan ? (
            <p className="text-xs text-muted-foreground">
              {t(
                initialPro.plan === "monthly"
                  ? "settings.proPlanMonthly"
                  : initialPro.plan === "annual"
                    ? "settings.proPlanAnnual"
                    : "settings.proPlanLifetime"
              )}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {initialPro.active
              ? t("settings.proAdFree")
              : t("settings.proBillingUnavailable")}
          </p>
          {initialPro.active && initialPro.currentPeriodEnd ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.proEndsAt", {
                date: new Date(initialPro.currentPeriodEnd).toLocaleDateString(),
              })}
            </p>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title={t("settings.contactEmail")}
        description={t("settings.contactEmailDesc")}
      >
        <Field label={t("settings.contactEmail")}>
          <Input
            type="email"
            value={contactEmail}
            placeholder={t("settings.contactEmailPlaceholder")}
            autoComplete="email"
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </Field>
        <Button
          type="button"
          disabled={
            pending ||
            contactEmail.trim().toLowerCase() ===
              (settings.contactEmail ?? "")
          }
          onClick={saveContactEmail}
        >
          {contactEmail.trim()
            ? t("settings.updateContactEmail")
            : t("settings.clearContactEmail")}
        </Button>
      </SettingsCard>
    </>
  );
}
