import { getDb, getEnv } from "@/lib/db";

export const DETECT_MODEL = "@cf/meta/llama-3.2-1b-instruct";
export const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";

export type ContentLang = "en" | "ru";
export type DetectedLang = ContentLang | "other";
export type TranslationStatus = "pending" | "ready" | "skipped" | "failed";

const MIN_LETTERS = 8;
const CHUNK_CHARS = 900;

type AiBinding = {
  run: (
    model: string,
    input: Record<string, unknown>
  ) => Promise<unknown>;
};

async function getAi(): Promise<AiBinding | null> {
  try {
    const env = await getEnv();
    if (!("AI" in env) || !env.AI) return null;
    return env.AI as AiBinding;
  } catch (error) {
    console.warn("AI binding unavailable for translation", error);
    return null;
  }
}

function letterStats(text: string): {
  letters: number;
  cyrillic: number;
  latin: number;
} {
  let letters = 0;
  let cyrillic = 0;
  let latin = 0;
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) {
      letters += 1;
      latin += 1;
    } else if (/[А-Яа-яЁёІіЇїЄєҐґ]/.test(ch)) {
      letters += 1;
      cyrillic += 1;
    }
  }
  return { letters, cyrillic, latin };
}

/** Fast en/ru/other guess from script mix. Returns null when ambiguous. */
export function detectLanguageHeuristic(text: string): DetectedLang | null {
  const { letters, cyrillic, latin } = letterStats(text);
  if (letters < MIN_LETTERS) return "other";
  const cyrRatio = cyrillic / letters;
  const latRatio = latin / letters;
  if (cyrRatio >= 0.7) return "ru";
  if (latRatio >= 0.7 && cyrillic === 0) return "en";
  if (cyrRatio >= 0.55 && latRatio < 0.35) return "ru";
  if (latRatio >= 0.55 && cyrRatio < 0.2) return "en";
  return null;
}

function parseDetectResponse(raw: unknown): DetectedLang | null {
  const text =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "response" in raw
        ? String((raw as { response: unknown }).response)
        : JSON.stringify(raw ?? "");
  const match = text.toLowerCase().match(/\b(en|ru|other)\b/);
  if (!match) return null;
  return match[1] as DetectedLang;
}

export async function detectLanguage(text: string): Promise<DetectedLang> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "other";

  const heuristic = detectLanguageHeuristic(cleaned);
  if (heuristic !== null) return heuristic;

  const ai = await getAi();
  if (!ai) return "other";

  try {
    const sample = cleaned.slice(0, 600);
    const result = await ai.run(DETECT_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Classify the language of the user text. Reply with exactly one token: en, ru, or other. No punctuation.",
        },
        { role: "user", content: sample },
      ],
      max_tokens: 8,
      temperature: 0,
    });
    return parseDetectResponse(result) ?? "other";
  } catch (error) {
    console.warn("Language detection failed", error);
    return "other";
  }
}

function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.4) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function translateChunk(
  ai: AiBinding,
  text: string,
  source: ContentLang,
  target: ContentLang
): Promise<string | null> {
  try {
    const result = (await ai.run(TRANSLATE_MODEL, {
      text,
      source_lang: source,
      target_lang: target,
    })) as { translated_text?: string } | string;

    if (typeof result === "string") return result.trim() || null;
    const translated = result?.translated_text?.trim();
    return translated || null;
  } catch (error) {
    console.warn("Workers AI translation chunk failed", error);
    return null;
  }
}

export async function translateText(
  text: string,
  source: ContentLang,
  target: ContentLang
): Promise<string | null> {
  if (!text.trim() || source === target) return null;
  const ai = await getAi();
  if (!ai) return null;

  const chunks = chunkText(text);
  if (chunks.length === 0) return null;

  const out: string[] = [];
  for (const chunk of chunks) {
    const translated = await translateChunk(ai, chunk, source, target);
    if (!translated) return null;
    out.push(translated);
  }
  return out.join("\n\n");
}

export function otherLang(lang: ContentLang): ContentLang {
  return lang === "en" ? "ru" : "en";
}

async function markPost(
  postId: string,
  fields: {
    status: TranslationStatus;
    sourceLang?: DetectedLang | null;
    titleTranslated?: string | null;
    bodyTranslated?: string | null;
  }
) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE posts
       SET translation_status = ?,
           source_lang = COALESCE(?, source_lang),
           title_translated = ?,
           body_translated = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      fields.status,
      fields.sourceLang ?? null,
      fields.titleTranslated ?? null,
      fields.bodyTranslated ?? null,
      postId
    )
    .run();
}

async function markComment(
  commentId: string,
  fields: {
    status: TranslationStatus;
    sourceLang?: DetectedLang | null;
    bodyTranslated?: string | null;
  }
) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE comments
       SET translation_status = ?,
           source_lang = COALESCE(?, source_lang),
           body_translated = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      fields.status,
      fields.sourceLang ?? null,
      fields.bodyTranslated ?? null,
      commentId
    )
    .run();
}

/** Detect language and store en↔ru translation for a post. */
export async function processPostTranslation(postId: string): Promise<void> {
  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, title, body, translation_status FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(postId)
    .first<{
      id: string;
      title: string;
      body: string | null;
      translation_status: string;
    }>();

  if (!post) return;

  const sample = `${post.title}\n${post.body ?? ""}`.trim();
  const detected = await detectLanguage(sample);

  if (detected !== "en" && detected !== "ru") {
    await markPost(postId, {
      status: "skipped",
      sourceLang: detected,
      titleTranslated: null,
      bodyTranslated: null,
    });
    return;
  }

  const target = otherLang(detected);
  const titleTranslated = await translateText(post.title, detected, target);
  const bodyTranslated = post.body
    ? await translateText(post.body, detected, target)
    : null;

  if (!titleTranslated && !bodyTranslated) {
    await markPost(postId, {
      status: "failed",
      sourceLang: detected,
      titleTranslated: null,
      bodyTranslated: null,
    });
    return;
  }

  await markPost(postId, {
    status: "ready",
    sourceLang: detected,
    titleTranslated: titleTranslated ?? post.title,
    bodyTranslated,
  });
}

/** Detect language and store en↔ru translation for a comment. */
export async function processCommentTranslation(
  commentId: string
): Promise<void> {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, body, is_deleted, translation_status
       FROM comments WHERE id = ? AND is_removed = 0`
    )
    .bind(commentId)
    .first<{
      id: string;
      body: string;
      is_deleted: number;
      translation_status: string;
    }>();

  if (!comment || comment.is_deleted) return;

  const detected = await detectLanguage(comment.body);
  if (detected !== "en" && detected !== "ru") {
    await markComment(commentId, {
      status: "skipped",
      sourceLang: detected,
      bodyTranslated: null,
    });
    return;
  }

  const target = otherLang(detected);
  const bodyTranslated = await translateText(comment.body, detected, target);
  if (!bodyTranslated) {
    await markComment(commentId, {
      status: "failed",
      sourceLang: detected,
      bodyTranslated: null,
    });
    return;
  }

  await markComment(commentId, {
    status: "ready",
    sourceLang: detected,
    bodyTranslated,
  });
}

/** Fire-and-forget translation job (waitUntil when available). */
export function schedulePostTranslation(postId: string): void {
  void runInBackground(async () => {
    try {
      await processPostTranslation(postId);
    } catch (error) {
      console.warn("Post translation job failed", postId, error);
      try {
        await markPost(postId, { status: "failed" });
      } catch {
        // ignore
      }
    }
  });
}

export function scheduleCommentTranslation(commentId: string): void {
  void runInBackground(async () => {
    try {
      await processCommentTranslation(commentId);
    } catch (error) {
      console.warn("Comment translation job failed", commentId, error);
      try {
        await markComment(commentId, { status: "failed" });
      } catch {
        // ignore
      }
    }
  });
}

async function runInBackground(task: () => Promise<void>): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx?.waitUntil) {
      ctx.waitUntil(task());
      return;
    }
  } catch {
    // local / missing context
  }
  void task();
}
