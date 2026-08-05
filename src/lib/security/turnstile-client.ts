"use client";

import { isE2eBotBypass } from "@/lib/security/bot-signals";

/** Whether a real Turnstile token is required before submit. */
export function requiresTurnstileToken(token: string | null | undefined): boolean {
  if (isE2eBotBypass()) return false;
  return !token?.trim();
}
