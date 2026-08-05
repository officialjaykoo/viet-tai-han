import { AuthError } from "@/lib/session";
import {
  BOT_FIELD,
  type BotAttestation,
  evaluateAttestation,
} from "@/lib/security/bot-signals";

/**
 * Pull and validate `_red` attestation from a JSON API body.
 * Strips the field so handlers never persist it.
 */
export function takeBotAttestation(body: unknown): {
  clean: Record<string, unknown>;
  attestation: BotAttestation | null;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { clean: {}, attestation: null };
  }
  const record = { ...(body as Record<string, unknown>) };
  const raw = record[BOT_FIELD];
  delete record[BOT_FIELD];
  if (!raw || typeof raw !== "object") {
    return { clean: record, attestation: null };
  }
  return { clean: record, attestation: raw as BotAttestation };
}

export function requireBotAttestation(body: unknown): Record<string, unknown> {
  const { clean, attestation } = takeBotAttestation(body);
  const result = evaluateAttestation(attestation);
  if (!result.ok) {
    // Generic message — don't teach bots which check failed.
    throw new AuthError("Could not verify request", 403);
  }
  return clean;
}
