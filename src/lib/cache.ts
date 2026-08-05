import { getEnv } from "@/lib/db";

/**
 * Edge cache for read-heavy, infrequently written data.
 *
 * Cloudflare has no Memcached/Redis product on Workers. The closest
 * Redis-like store is Workers KV (global, eventually consistent, high-read).
 * We layer a short isolate-local Map in front for sub-ms hits within a Worker.
 *
 * Use for: site_settings, banned_words, ad placement picks, public feed snapshots.
 * Do NOT use for: vote tallies, balances, anything needing strong consistency.
 */

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memory = new Map<string, MemoryEntry>();
const MEMORY_MAX_KEYS = 500;

async function getKv(): Promise<KVNamespace | null> {
  try {
    const env = await getEnv();
    return (env as CloudflareEnv & { CACHE?: KVNamespace }).CACHE ?? null;
  } catch {
    return null;
  }
}

function memoryGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  if (memory.size >= MEMORY_MAX_KEYS) {
    // Drop oldest-ish entry (Map insertion order)
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
  memory.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });
}

function memoryDelete(key: string) {
  memory.delete(key);
}

export async function cacheGet(key: string): Promise<string | null> {
  const local = memoryGet(key);
  if (local != null) return local;

  const kv = await getKv();
  if (!kv) return null;

  try {
    const value = await kv.get(key);
    if (value != null) {
      // Rehydrate L1 briefly so the next call in this isolate is free
      memorySet(key, value, 15);
    }
    return value;
  } catch (error) {
    console.error("CACHE get failed", key, error);
    return null;
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = 60
): Promise<void> {
  memorySet(key, value, Math.min(ttlSeconds, 60));
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.put(key, value, {
      expirationTtl: Math.max(60, ttlSeconds), // KV minimum is 60s
    });
  } catch (error) {
    console.error("CACHE put failed", key, error);
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  memoryDelete(key);
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch (error) {
    console.error("CACHE delete failed", key, error);
  }
}

export async function cacheDeletePrefix(prefix: string): Promise<void> {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  const kv = await getKv();
  if (!kv) return;
  try {
    let cursor: string | undefined;
    do {
      const page = await kv.list({ prefix, cursor });
      await Promise.all(page.keys.map((k) => kv.delete(k.name)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (error) {
    console.error("CACHE deletePrefix failed", prefix, error);
  }
}

export const CacheKeys = {
  siteSetting: (key: string) => `setting:${key}`,
  siteSettingsAll: "settings:all",
  bannedWords: "mod:banned_words",
  adPlacement: (placement: string) => `ads:placement:${placement}`,
} as const;
