import { getDb, getEnv } from "@/lib/db";
import type {
  ContentSourceLang,
  ContentTargetLang,
} from "@/lib/types";

export const DETECT_MODEL = "@cf/meta/llama-3.2-1b-instruct";
export const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";
export const TRANSLATION_TARGETS = ["vi", "ko"] as const satisfies readonly ContentTargetLang[];

export type ContentLang = ContentSourceLang;
export type DetectedLang = ContentLang;
export type TranslationStatus = "pending" | "ready" | "skipped" | "failed";

const MIN_LETTERS = 6;
const CHUNK_CHARS = 900;
const VIETNAMESE_WORDS = new Set([
  "ban",
  "cach",
  "cac",
  "chao",
  "cho",
  "co",
  "cua",
  "duoc",
  "la",
  "mot",
  "muon",
  "nguoi",
  "nhung",
  "nay",
  "se",
  "toi",
  "trong",
  "va",
  "viet",
  "voi",
  "xin",
]);
const ENGLISH_WORDS = new Set([
  "about",
  "and",
  "are",
  "can",
  "community",
  "for",
  "from",
  "has",
  "have",
  "hello",
  "help",
  "how",
  "is",
  "not",
  "please",
  "post",
  "that",
  "the",
  "this",
  "what",
  "with",
  "will",
  "you",
  "your",
]);

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
  hangul: number;
} {
  let letters = 0;
  let cyrillic = 0;
  let latin = 0;
  let hangul = 0;
  for (const ch of text) {
    if (/\p{Script=Latin}/u.test(ch)) {
      letters += 1;
      latin += 1;
    } else if (/\p{Script=Cyrillic}/u.test(ch)) {
      letters += 1;
      cyrillic += 1;
    } else if (/\p{Script=Hangul}/u.test(ch)) {
      letters += 1;
      hangul += 1;
    }
  }
  return { letters, cyrillic, latin, hangul };
}

function wordStats(text: string): {
  vietnamese: number;
  english: number;
} {
  const words = text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/đ/g, "d")
    .replace(/\p{M}/gu, "")
    .match(/\p{L}+/gu) ?? [];
  let vietnamese = 0;
  let english = 0;
  for (const word of words) {
    if (VIETNAMESE_WORDS.has(word)) vietnamese += 1;
    if (ENGLISH_WORDS.has(word)) english += 1;
  }
  return { vietnamese, english };
}

/** Fast script/lexicon guess for the languages supported by the product. */
export function detectLanguageHeuristic(text: string): DetectedLang | null {
  const { letters, cyrillic, latin, hangul } = letterStats(text);
  if (letters < MIN_LETTERS) return "other";

  const hangulRatio = hangul / letters;
  const cyrillicRatio = cyrillic / letters;
  if (hangulRatio >= 0.3) return "ko";
  if (cyrillicRatio >= 0.55) return "ru";

  const { vietnamese, english } = wordStats(text);
  const hasVietnameseDiacritics =
    /[ĂăÂâĐđÊêÔôƠơƯưÁáÀàẢảÃãẠạẮắẰằẲẳẴẵẶặẤấẦầẨẩẪẫẬậẾếỀềỂểỄễỆệỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỨứỪừỬửỮữỰự]/.test(
      text
    );
  if (hasVietnameseDiacritics || vietnamese >= 2 && vietnamese >= english) {
    return "vi";
  }
  if (english >= 2 || (english >= 1 && vietnamese === 0 && latin >= MIN_LETTERS)) {
    return "en";
  }
  return null;
}

function parseDetectResponse(raw: unknown): DetectedLang | null {
  const text =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "response" in raw
        ? String((raw as { response: unknown }).response)
        : JSON.stringify(raw ?? "");
  const match = text
    .toLowerCase()
    .match(/(?:^|[^a-z])(vi|ko|en|ru|other)(?:$|[^a-z])/);
  return match?.[1] as DetectedLang | undefined ?? null;
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
            "Classify the language of the user text. Reply with exactly one token: vi, ko, en, ru, or other. No punctuation.",
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
  target: ContentTargetLang
): Promise<string | null> {
  if (source === "other" || source === target) return null;

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
  target: ContentTargetLang
): Promise<string | null> {
  if (!text.trim() || source === target || source === "other") return null;
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

/**
 * Choose one cached translation target for the two supported UI locales.
 * Content written in a third supported source language uses Vietnamese as the
 * product-default target; vi/ko content is translated for the other locale.
 */
export function translationTargetFor(
  source: DetectedLang
): ContentTargetLang | null {
  switch (source) {
    case "vi":
      return "ko";
    case "ko":
      return "vi";
    case "en":
    case "ru":
      return "vi";
    default:
      return null;
  }
}

async function markPost(
  postId: string,
  fields: {
    status: TranslationStatus;
    sourceLang?: DetectedLang | null;
    targetLang?: ContentTargetLang | null;
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
           translation_target_lang = COALESCE(?, translation_target_lang),
           title_translated = ?,
           body_translated = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      fields.status,
      fields.sourceLang ?? null,
      fields.targetLang ?? null,
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
    targetLang?: ContentTargetLang | null;
    bodyTranslated?: string | null;
  }
) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE comments
       SET translation_status = ?,
           source_lang = COALESCE(?, source_lang),
           translation_target_lang = COALESCE(?, translation_target_lang),
           body_translated = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      fields.status,
      fields.sourceLang ?? null,
      fields.targetLang ?? null,
      fields.bodyTranslated ?? null,
      commentId
    )
    .run();
}

/** Detect language and store a vi/ko-facing translation for a post. */
export async function processPostTranslation(postId: string): Promise<void> {
  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, title, body, translation_status
       FROM posts
       WHERE id = ? AND is_removed = 0`
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
  const target = translationTargetFor(detected);

  if (!target) {
    await markPost(postId, {
      status: "skipped",
      sourceLang: detected,
      targetLang: null,
      titleTranslated: null,
      bodyTranslated: null,
    });
    return;
  }

  const titleTranslated = await translateText(post.title, detected, target);
  const bodyTranslated = post.body
    ? await translateText(post.body, detected, target)
    : null;

  if (!titleTranslated && !bodyTranslated) {
    await markPost(postId, {
      status: "failed",
      sourceLang: detected,
      targetLang: target,
      titleTranslated: null,
      bodyTranslated: null,
    });
    return;
  }

  await markPost(postId, {
    status: "ready",
    sourceLang: detected,
    targetLang: target,
    titleTranslated: titleTranslated ?? post.title,
    bodyTranslated,
  });
}

/** Detect language and store a vi/ko-facing translation for a comment. */
export async function processCommentTranslation(
  commentId: string
): Promise<void> {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, body, is_deleted, translation_status
       FROM comments
       WHERE id = ? AND is_removed = 0`
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
  const target = translationTargetFor(detected);
  if (!target) {
    await markComment(commentId, {
      status: "skipped",
      sourceLang: detected,
      targetLang: null,
      bodyTranslated: null,
    });
    return;
  }

  const bodyTranslated = await translateText(comment.body, detected, target);
  if (!bodyTranslated) {
    await markComment(commentId, {
      status: "failed",
      sourceLang: detected,
      targetLang: target,
      bodyTranslated: null,
    });
    return;
  }

  await markComment(commentId, {
    status: "ready",
    sourceLang: detected,
    targetLang: target,
    bodyTranslated,
  });
}

/** Re-run pending/legacy translations for an operator-controlled batch. */
export async function backfillContentTranslations(limit = 100): Promise<{
  postsProcessed: number;
  commentsProcessed: number;
  failed: number;
}> {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const [{ results: posts }, { results: comments }] = await Promise.all([
    db
      .prepare(
        `SELECT id
         FROM posts
         WHERE is_removed = 0
           AND is_shadow_hidden = 0
           AND (
             translation_status IN ('pending', 'failed')
             OR (
               translation_status = 'ready'
               AND source_lang IN ('vi', 'ko', 'en', 'ru')
               AND translation_target_lang IS NULL
             )
           )
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(safeLimit)
      .all<{ id: string }>(),
    db
      .prepare(
        `SELECT id
         FROM comments
         WHERE is_removed = 0
           AND is_deleted = 0
           AND is_shadow_hidden = 0
           AND (
             translation_status IN ('pending', 'failed')
             OR (
               translation_status = 'ready'
               AND source_lang IN ('vi', 'ko', 'en', 'ru')
               AND translation_target_lang IS NULL
             )
           )
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(safeLimit)
      .all<{ id: string }>(),
  ]);

  let failed = 0;
  for (const row of posts ?? []) {
    try {
      await processPostTranslation(row.id);
    } catch {
      failed += 1;
    }
  }
  for (const row of comments ?? []) {
    try {
      await processCommentTranslation(row.id);
    } catch {
      failed += 1;
    }
  }

  return {
    postsProcessed: posts?.length ?? 0,
    commentsProcessed: comments?.length ?? 0,
    failed,
  };
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
