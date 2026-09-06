"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { PushConfigState } from "@/lib/push";

function decodeVapidKey(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = window.atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
type BrowserPushState = "unknown" | "supported" | "unsupported" | "denied";

class PushServiceWorkerError extends Error {
  constructor() {
    super("Service worker failed to activate");
    this.name = "PushServiceWorkerError";
  }
}

async function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> {
  const readyRegistration = navigator.serviceWorker.ready.then(
    (currentRegistration) => {
      if (!currentRegistration.active) throw new PushServiceWorkerError();
      return currentRegistration;
    }
  );
  if (registration.active) return readyRegistration;

  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "redundant") {
    throw new PushServiceWorkerError();
  }

  const { promise: activationFailure, reject } =
    Promise.withResolvers<never>();
  const onStateChange = () => {
    if (worker.state === "redundant") reject(new PushServiceWorkerError());
  };
  worker.addEventListener("statechange", onStateChange);
  onStateChange();

  return Promise.race([readyRegistration, activationFailure]).finally(() => {
    worker.removeEventListener("statechange", onStateChange);
  });
}

function detectBrowserPushState(): BrowserPushState {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "supported";
}

export function PushSettings({
  available,
  configuration,
  publicKey,
  initialSubscribed,
}: {
  available: boolean;
  configuration: PushConfigState;
  publicKey: string | null;
  initialSubscribed: boolean;
}) {
  const { t } = useI18n();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserState, setBrowserState] =
    useState<BrowserPushState>("unknown");

  useEffect(() => {
    // Browser-only capability detection must run after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowserState(detectBrowserPushState());
  }, []);

  async function enable() {
    setError(null);
    if (configuration !== "configured" || !available || !publicKey) {
      setError(
        configuration === "invalid"
          ? t("notifications.pushInvalidConfiguration")
          : configuration === "unavailable"
            ? t("notifications.pushRuntimeUnavailable")
            : t("notifications.pushUnavailable")
      );
      return;
    }
    const currentBrowserState = detectBrowserPushState();
    setBrowserState(currentBrowserState);
    if (currentBrowserState === "unsupported") {
      setError(t("notifications.pushUnsupported"));
      return;
    }
    if (currentBrowserState === "denied") {
      setError(t("notifications.pushPermissionDenied"));
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(t("notifications.pushPermissionDenied"));
        return;
      }
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch {
        throw new PushServiceWorkerError();
      }
      const activeRegistration =
        await waitForActiveServiceWorker(registration);
      const existing = await activeRegistration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await activeRegistration.pushManager.subscribe({
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
        cause instanceof PushServiceWorkerError || cause instanceof DOMException
          ? t("notifications.pushFailed")
          : cause instanceof Error
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
  const serverConfigured = configuration === "configured" && available;
  const browserBlocked =
    browserState === "unsupported" || browserState === "denied";
  const serverMessage =
    configuration === "invalid"
      ? t("notifications.pushInvalidConfiguration")
      : configuration === "unavailable"
        ? t("notifications.pushRuntimeUnavailable")
        : t("notifications.pushUnavailable");
  const statusMessage = subscribed
    ? t("notifications.pushEnabled")
    : !serverConfigured
      ? serverMessage
      : browserState === "unsupported"
        ? t("notifications.pushUnsupported")
        : browserState === "denied"
          ? t("notifications.pushPermissionDenied")
          : t("notifications.pushDisabled");

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
          disabled={busy || (!subscribed && (!serverConfigured || browserBlocked))}
          onClick={subscribed ? disable : enable}
        >
          {busy
            ? t("notifications.pushSaving")
            : subscribed
              ? t("notifications.pushDisable")
              : t("notifications.pushEnable")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {statusMessage}
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
