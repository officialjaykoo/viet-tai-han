import { getEnv } from "@/lib/db";
import { isE2eBotBypass } from "@/lib/security/bot-signals";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function getTurnstileSiteKey(): string {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    ""
  );
}

async function getTurnstileSecret(): Promise<string | null> {
  try {
    const env = await getEnv();
    const fromEnv = (env as CloudflareEnv & { TURNSTILE_SECRET_KEY?: string })
      .TURNSTILE_SECRET_KEY;
    if (fromEnv?.trim()) return fromEnv.trim();
  } catch {
    // Local unit tests / no Cloudflare context
  }
  const fromProcess = process.env.TURNSTILE_SECRET_KEY?.trim();
  return fromProcess || null;
}

/** Verify a Turnstile response token with Cloudflare siteverify (server-side only). */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  if (isE2eBotBypass()) {
    return { ok: true };
  }

  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, reason: "missing-input-response" };
  }

  const secret = await getTurnstileSecret();
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured");
    return { ok: false, reason: "missing-input-secret" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", trimmed);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      return {
        ok: false,
        reason: data["error-codes"]?.[0] ?? "failed",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("Turnstile siteverify failed", error);
    return { ok: false, reason: "siteverify-error" };
  }
}
