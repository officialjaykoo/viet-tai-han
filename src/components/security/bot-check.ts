"use client";

import { ParserTraps, useBotGuard } from "@/components/security/parser-traps";
import { apiFetch } from "@/lib/api-client";
import { isE2eBotBypass } from "@/lib/security/bot-signals";

/** Run Turnstile + honeypot/interaction checks, then mint the short-lived human cookie. */
export async function passBotCheck(
  guard: ReturnType<typeof useBotGuard>,
  turnstileToken?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  guard.markTrusted();
  const blocked = guard.assertHuman();
  if (blocked) {
    return { ok: false, error: blocked };
  }

  if (!isE2eBotBypass() && !turnstileToken?.trim()) {
    return { ok: false, error: "Complete the security check" };
  }

  const res = await apiFetch("/api/security/bot-check", {
    method: "POST",
    body: JSON.stringify({
      attestation: guard.buildAttestation(),
      turnstileToken: turnstileToken ?? "",
    }),
  });

  if (!res.ok) {
    return { ok: false, error: "Could not verify request" };
  }
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
  } | null;
  if (!data?.success) {
    return { ok: false, error: "Could not verify request" };
  }
  return { ok: true };
}

export { ParserTraps, useBotGuard };
