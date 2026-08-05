import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";

export async function setUserPreferredLanguage(
  userId: string,
  preferredLanguage: Locale
) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE "user"
       SET preferredLanguage = ?, updatedAt = datetime('now')
       WHERE id = ?`
    )
    .bind(preferredLanguage, userId)
    .run();
  return { preferredLanguage };
}
