/** Reddit-style generated avatars — deterministic from a seed. */

export const GENERATED_AVATAR_PREFIX = "generated:";

const BACKGROUNDS = [
  "#FF4500",
  "#FF8717",
  "#FFB000",
  "#46D160",
  "#0DD3BB",
  "#25B8F7",
  "#7193FF",
  "#7E53C1",
  "#FF66AC",
  "#EA0027",
  "#014980",
  "#24A0ED",
] as const;

const BODY_COLORS = ["#FFFFFF", "#FFF7ED", "#F0FDFA", "#EEF2FF"] as const;

const ACCENTS = [
  "#FF4500",
  "#FFB000",
  "#46D160",
  "#25B8F7",
  "#7E53C1",
  "#FF66AC",
  "#014980",
] as const;

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 64,
  xl: 96,
  "2xl": 120,
};

/** FNV-1a style hash → unsigned 32-bit. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createAvatarSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function encodeGeneratedAvatar(seed: string): string {
  return `${GENERATED_AVATAR_PREFIX}${seed}`;
}

export function isGeneratedAvatar(image: string | null | undefined): boolean {
  return Boolean(image?.startsWith(GENERATED_AVATAR_PREFIX));
}

export function normalizeAvatarImage(image: unknown): string | null {
  const value = typeof image === "string" ? image.trim() : "";
  if (!value) return null;
  if (isGeneratedAvatar(value) || value.startsWith("/")) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol === "https:") return value;
  if (
    url.protocol === "http:" &&
    url.hostname.toLowerCase().endsWith(".kakaocdn.net")
  ) {
    url.protocol = "https:";
    return url.toString();
  }
  return null;
}

export function isCustomAvatarUrl(image: string | null | undefined): boolean {
  const normalized = normalizeAvatarImage(image);
  return Boolean(normalized && !isGeneratedAvatar(normalized));
}

/** Prefer stored generated seed, else derive from username/id. */
export function resolveAvatarSeed(
  image: string | null | undefined,
  fallback: string
): string {
  if (image?.startsWith(GENERATED_AVATAR_PREFIX)) {
    return image.slice(GENERATED_AVATAR_PREFIX.length) || fallback;
  }
  return fallback;
}

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function avatarSizePx(size: AvatarSize): number {
  return SIZE_PX[size];
}

/** Inline SVG markup for a friendly mascot avatar (not Reddit's trademarked Snoo). */
export function renderAvatarSvg(seed: string): string {
  const rand = mulberry32(hashSeed(seed));
  const bg = pick(BACKGROUNDS, Math.floor(rand() * BACKGROUNDS.length));
  const body = pick(BODY_COLORS, Math.floor(rand() * BODY_COLORS.length));
  const accent = pick(ACCENTS, Math.floor(rand() * ACCENTS.length));

  const faceY = 54 + Math.floor(rand() * 4);
  const eyeSpread = 8 + Math.floor(rand() * 4);
  const eyeSize = 3.2 + rand() * 1.4;
  const blush = rand() > 0.55;
  const smile = rand() > 0.35;
  const antenna = Math.floor(rand() * 4); // 0 none, 1 ball, 2 sprout, 3 twin
  const cheeks = rand() > 0.4;
  const bodyScale = 0.92 + rand() * 0.1;

  const antennaSvg =
    antenna === 1
      ? `<path d="M64 28v-10" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
         <circle cx="64" cy="14" r="5" fill="${accent}"/>`
      : antenna === 2
        ? `<path d="M64 30c0-10 8-14 8-22" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
           <circle cx="72" cy="8" r="4.5" fill="${accent}"/>`
        : antenna === 3
          ? `<path d="M56 30c-2-10-8-12-10-18" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
             <path d="M72 30c2-10 8-12 10-18" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
             <circle cx="46" cy="10" r="3.5" fill="${accent}"/>
             <circle cx="82" cy="10" r="3.5" fill="${accent}"/>`
          : "";

  const mouth = smile
    ? `<path d="M56 ${faceY + 10}c3 5 13 5 16 0" fill="none" stroke="#1A1A1B" stroke-width="2.2" stroke-linecap="round"/>`
    : `<ellipse cx="64" cy="${faceY + 11}" rx="3.2" ry="2.2" fill="#1A1A1B"/>`;

  const cheekSvg = cheeks
    ? `<circle cx="${64 - eyeSpread - 6}" cy="${faceY + 4}" r="3.5" fill="${accent}" opacity="0.35"/>
       <circle cx="${64 + eyeSpread + 6}" cy="${faceY + 4}" r="3.5" fill="${accent}" opacity="0.35"/>`
    : "";

  const blushSvg = blush
    ? `<ellipse cx="64" cy="${faceY + 2}" rx="18" ry="14" fill="${accent}" opacity="0.08"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-hidden="true">
  <circle cx="64" cy="64" r="64" fill="${bg}"/>
  <g transform="translate(64 70) scale(${bodyScale.toFixed(3)}) translate(-64 -70)">
    ${antennaSvg}
    <ellipse cx="64" cy="78" rx="34" ry="30" fill="${body}"/>
    <circle cx="64" cy="52" r="28" fill="${body}"/>
    ${blushSvg}
    <circle cx="${64 - eyeSpread}" cy="${faceY}" r="${eyeSize.toFixed(2)}" fill="#1A1A1B"/>
    <circle cx="${64 + eyeSpread}" cy="${faceY}" r="${eyeSize.toFixed(2)}" fill="#1A1A1B"/>
    <circle cx="${64 - eyeSpread + 1}" cy="${faceY - 1.2}" r="${(eyeSize * 0.28).toFixed(2)}" fill="#fff" opacity="0.9"/>
    <circle cx="${64 + eyeSpread + 1}" cy="${faceY - 1.2}" r="${(eyeSize * 0.28).toFixed(2)}" fill="#fff" opacity="0.9"/>
    ${cheekSvg}
    ${mouth}
  </g>
</svg>`;
}

export function avatarDataUri(seed: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(renderAvatarSvg(seed))}`;
}

export function resolveAvatarSrc(
  image: string | null | undefined,
  fallbackSeed: string
): { kind: "url" | "generated"; src: string } {
  const normalized = normalizeAvatarImage(image);
  if (normalized && !isGeneratedAvatar(normalized)) {
    return { kind: "url", src: normalized };
  }
  const seed = resolveAvatarSeed(normalized, fallbackSeed);
  return { kind: "generated", src: avatarDataUri(seed) };
}
