import {
  CacheKeys,
  cacheDelete,
  cacheGet,
  cacheGetJson,
  cacheSet,
  cacheSetJson,
} from "@/lib/cache";
import { getDb } from "@/lib/db";

const SETTING_TTL_SECONDS = 120;

export async function getSiteSetting(key: string, fallback = ""): Promise<string> {
  const cacheKey = CacheKeys.siteSetting(key);
  const cached = await cacheGet(cacheKey);
  if (cached != null) return cached;

  const db = await getDb();
  const row = await db
    .prepare(`SELECT value FROM site_settings WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  const value = row?.value ?? fallback;
  await cacheSet(cacheKey, value, SETTING_TTL_SECONDS);
  return value;
}

export async function setSiteSetting(
  key: string,
  value: string,
  updatedBy?: string
) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at, updated_by)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now'),
         updated_by = excluded.updated_by`
    )
    .bind(key, value, updatedBy ?? null)
    .run();

  await Promise.all([
    cacheDelete(CacheKeys.siteSetting(key)),
    cacheDelete(CacheKeys.siteSettingsAll),
  ]);
  // Warm the single-key cache with the new value
  await cacheSet(CacheKeys.siteSetting(key), value, SETTING_TTL_SECONDS);
}

export async function listSiteSettings() {
  const cached = await cacheGetJson<
    Array<{ key: string; value: string; updated_at: string }>
  >(CacheKeys.siteSettingsAll);
  if (cached) return cached;

  const db = await getDb();
  const { results } = await db
    .prepare(`SELECT key, value, updated_at FROM site_settings ORDER BY key`)
    .all<{ key: string; value: string; updated_at: string }>();
  const rows = results ?? [];
  await cacheSetJson(CacheKeys.siteSettingsAll, rows, SETTING_TTL_SECONDS);
  return rows;
}
