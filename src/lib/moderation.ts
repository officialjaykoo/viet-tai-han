import {
  CacheKeys,
  cacheDelete,
  cacheGetJson,
  cacheSetJson,
} from "@/lib/cache";
import { getDb } from "@/lib/db";

export type BannedWordHit = {
  word: string;
  severity: "shadow" | "block";
};

const BANNED_WORDS_TTL_SECONDS = 60;

type BannedWordsLoad = {
  words: BannedWordHit[];
  d1ReadStatements: number;
};

async function loadBannedWords(force = false): Promise<BannedWordsLoad> {
  if (!force) {
    const cached = await cacheGetJson<BannedWordHit[]>(CacheKeys.bannedWords);
    if (cached) return { words: cached, d1ReadStatements: 0 };
  }

  const db = await getDb();
  const { results } = await db
    .prepare(`SELECT word, severity FROM banned_words`)
    .all<{ word: string; severity: "shadow" | "block" }>();

  const words = results ?? [];
  await cacheSetJson(CacheKeys.bannedWords, words, BANNED_WORDS_TTL_SECONDS);
  return { words, d1ReadStatements: 1 };
}

export async function getBannedWords(force = false): Promise<BannedWordHit[]> {
  return (await loadBannedWords(force)).words;
}

export function findBannedWordHits(
  text: string,
  words: BannedWordHit[]
): BannedWordHit[] {
  const haystack = text.toLowerCase();
  return words.filter((entry) => {
    const needle = entry.word.toLowerCase().trim();
    if (!needle) return false;
    if (/\s/.test(needle)) {
      return haystack.includes(needle);
    }
    const pattern = new RegExp(
      `(^|[^a-z0-9_])${escapeRegex(needle)}([^a-z0-9_]|$)`,
      "i"
    );
    return pattern.test(haystack);
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function moderateText(text: string): Promise<{
  blocked: boolean;
  shadow: boolean;
  hits: BannedWordHit[];
  d1ReadStatements: number;
}> {
  const loaded = await loadBannedWords();
  const hits = findBannedWordHits(text, loaded.words);
  return {
    blocked: hits.some((h) => h.severity === "block"),
    shadow: hits.some((h) => h.severity === "shadow"),
    hits,
    d1ReadStatements: loaded.d1ReadStatements,
  };
}

export async function invalidateBannedWordsCache() {
  await cacheDelete(CacheKeys.bannedWords);
}
