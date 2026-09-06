import type { VoteAction } from "@/lib/types";

export type DiscoverySource =
  | "home"
  | "popular"
  | "community"
  | "profile"
  | "search"
  | "direct"
  | "shared"
  | "unknown";

const SOURCE_TRUST: Record<DiscoverySource, number> = {
  home: 1,
  popular: 1,
  community: 1,
  search: 1,
  profile: 0.85,
  direct: 0.55,
  shared: 0.5,
  unknown: 0.45,
};

/**
 * Fixed baseline vote influence in millipoints (100 ≈ one classic point).
 * Reputation never changes a voter's base power; abuse controls apply only
 * behavioral and account-context dampening in effectiveVoteWeight.
 */
export function voteWeight(action: VoteAction): number {
  return action === "downvote" ? 40 : 100;
}

export function displayScore(millipoints: number): number {
  return Math.round(millipoints / 100);
}

export function personalizedDisplayScore(
  millipoints: number,
  viewer:
    | {
        value: number;
        weight: number;
      }
    | null
    | undefined
): number {
  if (!viewer || viewer.weight !== 0) {
    return displayScore(millipoints);
  }
  const action = viewer.value === 1 ? "upvote" : "downvote";
  const claimed = voteWeight(action);
  return displayScore(millipoints + signedVoteContribution(action, claimed));
}

export function signedVoteContribution(
  action: VoteAction,
  weight: number
): number {
  return action === "upvote" ? weight : -weight;
}

export function parseDiscoverySource(
  value: string | null | undefined
): DiscoverySource {
  if (
    value === "home" ||
    value === "popular" ||
    value === "community" ||
    value === "profile" ||
    value === "search" ||
    value === "direct" ||
    value === "shared" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

export function sourceTrustFactor(
  source: DiscoverySource | null | undefined
): number {
  if (!source) return SOURCE_TRUST.unknown * 0.78; // no prior view ≈ 0.35
  return SOURCE_TRUST[source];
}

/** No recorded browse before vote. */
export function noViewSourceTrust(): number {
  return 0.35;
}

/**
 * Velocity / brigade dampening based on vote behavior.
 * Downvote floods use a steeper curve; reputation is not an input.
 */
export function velocityFactor(input: {
  action: VoteAction;
  recentSameDirection: number;
}): number {
  const burstScore = Math.max(0, input.recentSameDirection);
  const steepness = input.action === "downvote" ? 0.55 : 0.35;
  return 1 / (1 + Math.log1p(burstScore) * steepness);
}

/** Penalize brand-new accounts and one-trick voters. */
export function accountTrustFactor(input: {
  accountAgeHours: number;
  votesOnOtherTargets: number;
}): number {
  const ageHours = Math.max(0, input.accountAgeHours);
  const ageFactor = 1 - Math.exp(-ageHours / 72); // ~half trust at ~50h
  const diversity =
    input.votesOnOtherTargets <= 0
      ? 0.45
      : input.votesOnOtherTargets < 3
        ? 0.7
        : 1;
  // New accounts remain meaningful voters; burst/source factors still dampen.
  return Math.max(0.5, Math.min(1, 0.35 + 0.65 * ageFactor) * diversity);
}

export function effectiveVoteWeight(input: {
  action: VoteAction;
  discoverySource: DiscoverySource | null;
  hasPriorView: boolean;
  recentSameDirection: number;
  accountAgeHours: number;
  votesOnOtherTargets: number;
}): number {
  const base = voteWeight(input.action);
  const source = input.hasPriorView
    ? sourceTrustFactor(input.discoverySource)
    : noViewSourceTrust();
  const velocity = velocityFactor({
    action: input.action,
    recentSameDirection: input.recentSameDirection,
  });
  const account = accountTrustFactor({
    accountAgeHours: input.accountAgeHours,
    votesOnOtherTargets: input.votesOnOtherTargets,
  });
  return Math.max(1, Math.round(base * source * velocity * account));
}

/** Reddit-style log dampened hot score from millipoints + age hours. */
export function computeHotScore(
  millipoints: number,
  ageHours: number
): number {
  const absPts = Math.abs(millipoints) / 100;
  const signedLog =
    millipoints >= 0 ? Math.log1p(absPts) : -Math.log1p(absPts);
  return signedLog / (Math.max(0, ageHours) + 2);
}

export function ageHoursSince(iso: string, now = Date.now()): number {
  const normalized = iso.includes("T")
    ? iso
    : iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z");
  const then = Date.parse(normalized);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now - then) / 3_600_000);
}
