export const CONSENT_VERSION = "2026-09-04";
export const CONSENT_STORAGE_KEY = `vth_consent_${CONSENT_VERSION}`;

export type ConsentChoice = {
  analytics: boolean;
  personalizedAds: boolean;
  marketing: boolean;
};

export const ESSENTIAL_CONSENT: ConsentChoice = {
  analytics: false,
  personalizedAds: false,
  marketing: false,
};

export const ALL_CONSENT: ConsentChoice = {
  analytics: true,
  personalizedAds: true,
  marketing: true,
};

export function isConsentChoice(value: unknown): value is ConsentChoice {
  if (!value || typeof value !== "object") return false;
  const choice = value as Record<string, unknown>;
  return (
    typeof choice.analytics === "boolean" &&
    typeof choice.personalizedAds === "boolean" &&
    typeof choice.marketing === "boolean"
  );
}
