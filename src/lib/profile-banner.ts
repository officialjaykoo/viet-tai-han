import { hashSeed } from "@/lib/avatar";

/** Deterministic banner colors when the user has no custom bannerKey. */
export function profileBannerGradient(seed: string): {
  from: string;
  to: string;
} {
  const hues = [
    [28, 18],
    [35, 55],
    [200, 230],
    [150, 180],
    [340, 20],
    [250, 280],
    [80, 110],
  ] as const;
  const pair = hues[hashSeed(seed) % hues.length]!;
  return {
    from: `oklch(0.52 0.14 ${pair[0]})`,
    to: `oklch(0.38 0.1 ${pair[1]})`,
  };
}
