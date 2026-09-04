import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  processCommentTranslation,
  processPostTranslation,
} from "@/lib/translation";

describe("multilingual translation persistence", () => {
  it("records the detected source and vi/ko target policy", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const userId = `translation_user_${suffix}`;
    const subredditId = `translation_subreddit_${suffix}`;
    const englishPostId = `translation_post_en_${suffix}`;
    const koreanPostId = `translation_post_ko_${suffix}`;
    const commentId = `translation_comment_${suffix}`;

    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
       VALUES (?, 'Translator', ?, 1, ?, 10, 'user', 'active')`
    )
      .bind(userId, `${userId}@test.local`, userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO subreddits (id, name, title, created_by, subscriber_count)
       VALUES (?, ?, 'Translation test', ?, 0)`
    )
      .bind(subredditId, `translation_${suffix}`, userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`
    )
      .bind(
        englishPostId,
        subredditId,
        userId,
        "This is a community post about housing",
        "Please share useful information.",
        koreanPostId,
        subredditId,
        userId,
        "한국에서 베트남 사람들을 위한 커뮤니티",
        "유용한 정보를 나눠 주세요."
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO comments (id, post_id, author_id, body)
       VALUES (?, ?, ?, ?)`
    )
      .bind(commentId, englishPostId, userId, "This is a helpful comment.")
      .run();

    await processPostTranslation(englishPostId);
    await processPostTranslation(koreanPostId);
    await processCommentTranslation(commentId);

    const posts = await env.DB.prepare(
      `SELECT id, source_lang, translation_target_lang, translation_status
       FROM posts WHERE id IN (?, ?)
       ORDER BY id`
    )
      .bind(englishPostId, koreanPostId)
      .all<{
        id: string;
        source_lang: string | null;
        translation_target_lang: string | null;
        translation_status: string;
      }>();
    const byId = new Map((posts.results ?? []).map((row) => [row.id, row]));
    expect(byId.get(englishPostId)).toMatchObject({
      source_lang: "en",
      translation_target_lang: "vi",
      translation_status: "failed",
    });
    expect(byId.get(koreanPostId)).toMatchObject({
      source_lang: "ko",
      translation_target_lang: "vi",
      translation_status: "failed",
    });

    const comment = await env.DB.prepare(
      `SELECT source_lang, translation_target_lang, translation_status
       FROM comments WHERE id = ?`
    )
      .bind(commentId)
      .first<{
        source_lang: string | null;
        translation_target_lang: string | null;
        translation_status: string;
      }>();
    expect(comment).toMatchObject({
      source_lang: "en",
      translation_target_lang: "vi",
      translation_status: "failed",
    });
  });
});
