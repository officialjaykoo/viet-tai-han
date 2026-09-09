import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  listReviewQueue,
  reviewContentReport,
} from "@/lib/review-queue";
import { seedUsersAndSubreddit } from "./helpers";

describe("unified review queue (D1)", () => {
  it("projects content reports and keeps dismissal non-destructive", async () => {
    const { adminId, authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const postId = `review_post_${crypto.randomUUID()}`;
    const dismissedReportId = `review_report_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, 'Review queue post', 'public report body')`
    )
      .bind(postId, subredditId, authorId)
      .run();
    await env.DB.prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details)
       VALUES (?, ?, 'post', ?, 'spam', 'A bounded report detail')`
    )
      .bind(dismissedReportId, actorId, postId)
      .run();

    const pending = await listReviewQueue({ status: "pending", source: "post" });
    expect(pending).toEqual([
      expect.objectContaining({
        sourceType: "post",
        reportId: dismissedReportId,
        status: "pending",
        targetSummary: "Review queue post",
        targetHref: `/post/${postId}`,
        actionableId: postId,
        reporterUsername: expect.stringContaining("actor_"),
      }),
    ]);

    await reviewContentReport({
      reportId: dismissedReportId,
      reviewerId: adminId,
      status: "dismissed",
    });
    const afterDismiss = await env.DB.prepare(
      `SELECT status, is_removed FROM reports r
       INNER JOIN posts p ON p.id = ? WHERE r.id = ?`
    )
      .bind(postId, dismissedReportId)
      .first<{ status: string; is_removed: number }>();
    expect(afterDismiss).toEqual({ status: "dismissed", is_removed: 0 });
  });

  it("actioning a report removes the target and records moderation audit", async () => {
    const { adminId, authorId, subredditId } = await seedUsersAndSubreddit();
    const postId = `action_review_post_${crypto.randomUUID()}`;
    const reportId = `action_review_report_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, 'Action review post', 'body')`
    )
      .bind(postId, subredditId, authorId)
      .run();
    await env.DB.prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason)
       VALUES (?, ?, 'post', ?, 'harassment')`
    )
      .bind(reportId, adminId, postId)
      .run();

    await reviewContentReport({
      reportId,
      reviewerId: adminId,
      status: "reviewed",
      removeTarget: true,
    });
    const post = await env.DB.prepare(
      `SELECT is_removed FROM posts WHERE id = ?`
    )
      .bind(postId)
      .first<{ is_removed: number }>();
    const audit = await env.DB.prepare(
      `SELECT action, target_type, target_id FROM moderation_actions
       WHERE target_type = 'post' AND target_id = ?
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(postId)
      .first<{ action: string; target_type: string; target_id: string }>();

    expect(post?.is_removed).toBe(1);
    expect(audit).toEqual({
      action: "remove",
      target_type: "post",
      target_id: postId,
    });
    await expect(
      reviewContentReport({
        reportId,
        reviewerId: adminId,
        status: "reviewed",
        removeTarget: true,
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});
