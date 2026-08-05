/** Client-safe Turnstile sitekey (public by design). */

export function getTurnstileSiteKey(): string {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    ""
  );
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey().length > 0;
}
