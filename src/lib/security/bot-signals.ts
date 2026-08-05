/** Shared bot-attestation shape (browser + server). */

export const BOT_FIELD = "_red";

export const HONEYPOT_NAMES = [
  "website",
  "url",
  "company",
  "phone",
  "fax",
  "contact_email_2",
] as const;

export type HoneypotName = (typeof HONEYPOT_NAMES)[number];

export type BotAttestation = {
  v: 1;
  /** Form / page mount time (ms). */
  t0: number;
  /** Submit time (ms). */
  ts: number;
  dwellMs: number;
  moves: number;
  keys: number;
  focuses: number;
  scrolls: number;
  /** At least one isTrusted user gesture observed. */
  trusted: boolean;
  webdriver: boolean;
  /** Honeypot values — must all be empty strings. */
  traps: Partial<Record<HoneypotName, string>>;
};

export const MIN_DWELL_MS = 900;
export const MIN_INTERACTIONS = 1;

/** Playwright / CI only — never enable in production. */
export function isE2eBotBypass(): boolean {
  return (
    process.env.E2E_BOT_BYPASS === "1" ||
    process.env.NEXT_PUBLIC_E2E_BOT_BYPASS === "1"
  );
}

export function honeypotsFilled(traps: BotAttestation["traps"] | undefined): boolean {
  if (!traps) return true;
  return HONEYPOT_NAMES.some((name) => {
    const v = traps[name];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function evaluateAttestation(att: BotAttestation | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (isE2eBotBypass()) {
    return { ok: true };
  }
  if (!att || att.v !== 1) {
    return { ok: false, reason: "Missing bot attestation" };
  }
  if (honeypotsFilled(att.traps)) {
    return { ok: false, reason: "Rejected" };
  }
  if (att.webdriver) {
    return { ok: false, reason: "Automation detected" };
  }
  if (att.dwellMs < MIN_DWELL_MS) {
    return { ok: false, reason: "Submitted too quickly" };
  }
  if (!att.trusted) {
    return { ok: false, reason: "No user interaction" };
  }
  const interactions = att.moves + att.keys + att.focuses + att.scrolls;
  if (interactions < MIN_INTERACTIONS) {
    return { ok: false, reason: "No user interaction" };
  }
  // Clock sanity: submit should be after mount, within 2h
  if (att.ts < att.t0 || att.ts - att.t0 > 2 * 60 * 60 * 1000) {
    return { ok: false, reason: "Invalid timing" };
  }
  if (Math.abs(att.dwellMs - (att.ts - att.t0)) > 5_000) {
    return { ok: false, reason: "Invalid timing" };
  }
  return { ok: true };
}
