"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

function decodeVapidKey(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = window.atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function PushSettings({
  available,
  publicKey,
  initialSubscribed,
}: {
  available: boolean;
  publicKey: string | null;
  initialSubscribed: boolean;
}) {
  const { t } = useI18n();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setError(null);
    if (!available || !publicKey) {
      setError(t("notifications.pushUnavailable"));
      return;
    }
    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setError(t("notifications.pushUnsupported"));
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(t("notifications.pushPermissionDenied"));
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey) as BufferSource,
        }));
      const res = await apiFetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? t("notifications.pushFailed"));
      setSubscribed(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("notifications.pushFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const res = await apiFetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) throw new Error(data?.error ?? t("notifications.pushFailed"));
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("notifications.pushFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("notifications.pushTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("notifications.pushDescription")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={subscribed ? "outline" : "default"}
          disabled={busy || !available}
          onClick={subscribed ? disable : enable}
        >
          {busy
            ? t("notifications.pushSaving")
            : subscribed
              ? t("notifications.pushDisable")
              : t("notifications.pushEnable")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {subscribed
            ? t("notifications.pushEnabled")
            : available
              ? t("notifications.pushDisabled")
              : t("notifications.pushUnavailable")}
        </span>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
