import {
  isSensitiveSiteSettingKey,
  validateSiteSettingValue,
} from "@/lib/site-setting-definitions";
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
export class SiteSettingValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "SiteSettingValidationError";
  }
}

export type SiteSettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

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
): Promise<void> {
  await setSiteSettings([{ key, value }], updatedBy);
}

export async function setSiteSettings(
  settings: Array<{ key: string; value: string }>,
  updatedBy?: string
): Promise<void> {
  if (settings.length === 0 || settings.length > 100) {
    throw new SiteSettingValidationError(
      "At least one and at most 100 settings are required"
    );
  }

  const validated = settings.map((setting) => {
    if (typeof setting.key !== "string" || typeof setting.value !== "string") {
      throw new SiteSettingValidationError("Invalid setting");
    }
    const result = validateSiteSettingValue(setting.key, setting.value);
    if (!result.ok) throw new SiteSettingValidationError(result.error);
    return { key: setting.key, value: result.value };
  });

  const db = await getDb();
  await db.batch(
    validated.map(({ key, value }) =>
      db
        .prepare(
          `INSERT INTO site_settings (key, value, updated_at, updated_by)
           VALUES (?, ?, datetime('now'), ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = datetime('now'),
             updated_by = excluded.updated_by`
        )
        .bind(key, value, updatedBy ?? null)
    )
  );

  await Promise.all([
    cacheDelete(CacheKeys.siteSettingsAll),
    ...validated.map(({ key, value }) => [
      cacheDelete(CacheKeys.siteSetting(key)),
      cacheSet(CacheKeys.siteSetting(key), value, SETTING_TTL_SECONDS),
    ]).flat(),
  ]);
}

export async function listSiteSettings(): Promise<SiteSettingRow[]> {
  const cached = await cacheGetJson<SiteSettingRow[]>(CacheKeys.siteSettingsAll);
  if (cached) return cached;

  const db = await getDb();
  const { results } = await db
    .prepare(`SELECT key, value, updated_at FROM site_settings ORDER BY key`)
    .all<SiteSettingRow>();
  const rows = (results ?? []).filter(
    (row) => !isSensitiveSiteSettingKey(row.key)
  );
  await cacheSetJson(CacheKeys.siteSettingsAll, rows, SETTING_TTL_SECONDS);
  return rows;
}

export async function listSensitiveSiteSettingKeys(): Promise<string[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(`SELECT key FROM site_settings ORDER BY key`)
    .all<{ key: string }>();
  return (results ?? [])
    .map((row) => row.key)
    .filter(isSensitiveSiteSettingKey);
}
