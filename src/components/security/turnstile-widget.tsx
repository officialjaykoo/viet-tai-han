"use client";

import type { MutableRefObject } from "react";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { getTurnstileSiteKey } from "@/lib/security/turnstile-public";
import { cn } from "@/lib/utils";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void;
  className?: string;
  /** Imperative reset handle — assign `.current.reset()` after successful submits. */
  resetRef?: MutableRefObject<{ reset: () => void } | null>;
};

export function TurnstileWidget({
  onToken,
  className,
  resetRef,
}: TurnstileWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const sitekey = getTurnstileSiteKey();
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !sitekey || !hostRef.current) return;

    let cancelled = false;

    function mount() {
      if (cancelled || !hostRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey,
        action: "turnstile-spin-v1",
        appearance: "interaction-only",
        theme: "auto",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    }

    if (window.turnstile) {
      mount();
    } else {
      const onReady = () => mount();
      window.addEventListener("turnstile-script-loaded", onReady);
      // Script may already be loading; poll briefly
      const timer = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(timer);
          mount();
        }
      }, 50);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
        window.removeEventListener("turnstile-script-loaded", onReady);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [mounted, sitekey]);

  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = {
      reset: () => {
        onTokenRef.current(null);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    };
    return () => {
      resetRef.current = null;
    };
  }, [resetRef]);

  if (!mounted) {
    return (
      <div
        ref={hostRef}
        aria-hidden="true"
        className={cn("cf-turnstile", className)}
        data-action="turnstile-spin-v1"
      />
    );
  }

  if (!sitekey) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Turnstile site key is not configured.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          window.dispatchEvent(new Event("turnstile-script-loaded"));
        }}
      />
      <div
        ref={hostRef}
        className={cn("cf-turnstile", className)}
        data-action="turnstile-spin-v1"
      />
    </>
  );
}
