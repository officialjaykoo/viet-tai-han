"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  ALL_CONSENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  ESSENTIAL_CONSENT,
  isConsentChoice,
  type ConsentChoice,
} from "@/lib/consent";
import { apiJson } from "@/lib/api-client";

export function ConsentBanner({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        setVisible(!raw || !isConsentChoice(JSON.parse(raw)));
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function choose(choice: ConsentChoice) {
    setSaving(true);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // The server record still protects signed-in users when storage is blocked.
    }
    if (signedIn) {
      try {
        await apiJson("/api/me/consent", {
          method: "POST",
          body: { consentVersion: CONSENT_VERSION, ...choice },
        });
      } catch {
        // Keep the local choice; Settings can retry the server record.
      }
    }
    setSaving(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur sm:inset-x-6 sm:p-5"
      aria-label={t("consent.bannerTitle")}
    >
      <p className="font-heading text-base font-semibold">
        {t("consent.bannerTitle")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("consent.bannerDescription")}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => void choose(ESSENTIAL_CONSENT)}
        >
          {t("consent.essentialOnly")}
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => void choose(ALL_CONSENT)}
        >
          {t("consent.acceptAll")}
        </Button>
      </div>
    </aside>
  );
}
