/** Client-safe Turnstile sitekey (public by design). */

export function getTurnstileSiteKey(): string {
  const configured =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim();
  if (configured) return configured;

  if (typeof document !== "undefined") {
    return (
      document
        .querySelector('meta[name="turnstile-site-key"]')
        ?.getAttribute("content")
        ?.trim() ?? ""
    );
  }

  return "";
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey().length > 0;
}
