import { removeCommentForModeration, removePostForModeration } from "@/lib/actions";
import {
  listChatMessageReports,
  listChatRoomReports,
  type ChatReportStatus,
} from "@/lib/dm-moderation";
import {
  listListingReportQueue,
  type ListingReportQueueItem,
} from "@/lib/marketplace";
import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";

export type ReviewSourceType =
  | "post"
  | "comment"
  | "user"
  | "listing"
  | "business"
  | "chat";
export type ReviewStatus = "pending" | "actioned" | "dismissed";

export type ReviewQueueItem = {
  sourceType: ReviewSourceType;
  reportId: string;
  status: ReviewStatus;
  reason: string;
  details: string | null;
  createdAt: string;
  reporterUsername: string | null;
  targetSummary: string;
  targetHref: string | null;
  actionableId: string;
  chatReportType?: "message" | "conversation";
};

type QueueStatus = "pending" | "all";
type SourceFilter = ReviewSourceType | "all";

type ContentReportRow = {
  id: string;
  target_type: "post" | "comment" | "user";
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  reporter_username: string | null;
  target_summary: string | null;
  target_username: string | null;
  parent_post_id: string | null;
};

function mapStatus(status: "open" | "reviewed" | "dismissed"): ReviewStatus {
  if (status === "open") return "pending";
  if (status === "reviewed") return "actioned";
  return "dismissed";
}

function mapListingReport(report: ListingReportQueueItem): ReviewQueueItem {
  return {
    sourceType: "listing",
    reportId: report.id,
    status: mapStatus(report.status),
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt,
    reporterUsername: report.reporterUsername,
    targetSummary: report.listingTitle,
    targetHref: `/marketplace/${report.listingId}`,
    actionableId: report.listingId,
  };
}

async function listContentReports(status: QueueStatus): Promise<ReviewQueueItem[]> {
  const db = await getDb();
  const statusClause = status === "pending" ? "AND r.status = 'open'" : "";
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.target_type, r.target_id, r.reason, r.details, r.status,
         r.created_at, reporter.username AS reporter_username,
         CASE
           WHEN r.target_type = 'post' THEN substr(p.title, 1, 180)
           WHEN r.target_type = 'comment' THEN substr(c.body, 1, 180)
           ELSE substr(target_user.name, 1, 180)
         END AS target_summary,
         target_user.username AS target_username,
         c.post_id AS parent_post_id
       FROM reports r
       INNER JOIN "user" reporter ON reporter.id = r.reporter_id
       LEFT JOIN comments c
         ON r.target_type = 'comment' AND c.id = r.target_id
       LEFT JOIN posts p
         ON (r.target_type = 'post' AND p.id = r.target_id)
         OR (r.target_type = 'comment' AND p.id = c.post_id)
       LEFT JOIN "user" target_user
         ON r.target_type = 'user' AND target_user.id = r.target_id
       WHERE r.target_type IN ('post', 'comment', 'user') ${statusClause}
       ORDER BY r.created_at ASC, r.id ASC
       LIMIT 100`
    )
    .all<ContentReportRow>();

  return (results ?? []).map((row) => ({
    sourceType: row.target_type,
    reportId: row.id,
    status: mapStatus(row.status),
    reason: row.reason,
    details: row.details,
    createdAt: row.created_at,
    reporterUsername: row.reporter_username,
    targetSummary: row.target_summary?.trim() || `${row.target_type} ${row.target_id}`,
    targetHref:
      row.target_type === "post"
        ? `/post/${row.target_id}`
        : row.target_type === "comment"
          ? row.parent_post_id
            ? `/post/${row.parent_post_id}`
            : null
          : row.target_username
            ? `/u/${row.target_username}`
            : null,
    actionableId: row.target_id,
  }));
}

async function listChatReports(
  status: QueueStatus
): Promise<ReviewQueueItem[]> {
  const statuses: ChatReportStatus[] =
    status === "pending" ? ["open"] : ["open", "reviewed", "dismissed"];
  const reports = await Promise.all(
    statuses.flatMap((reportStatus) => [
      listChatMessageReports(reportStatus),
      listChatRoomReports(reportStatus),
    ])
  );
  return reports.flatMap((items) =>
    items.map((report) => ({
      sourceType: "chat" as const,
      reportId: report.id,
      status: mapStatus(report.status),
      reason: report.reason,
      details: report.details,
      createdAt: report.createdAt,
      reporterUsername: report.reporterUsername,
      targetSummary:
        report.reportType === "message"
          ? `Message from @${report.senderUsername ?? "unknown"}`
          : `Conversation with @${report.reportedUsername ?? "unknown"}`,
      targetHref: null,
      actionableId: report.reportType === "message" ? report.messageId : report.roomId,
      chatReportType: report.reportType,
    }))
  );
}

export async function listReviewQueue(options: {
  status?: QueueStatus;
  source?: SourceFilter;
} = {}): Promise<ReviewQueueItem[]> {
  const status = options.status ?? "pending";
  const source = options.source ?? "all";
  const include = (kind: ReviewSourceType) => source === "all" || source === kind;
  const [content, listings, chat] = await Promise.all([
    include("post") || include("comment") || include("user")
      ? listContentReports(status)
      : Promise.resolve([]),
    include("listing")
      ? Promise.all(
          (status === "pending"
            ? (["open"] as const)
            : (["open", "reviewed", "dismissed"] as const)
          ).map((reportStatus) => listListingReportQueue(reportStatus))
        ).then((groups) => groups.flat().map(mapListingReport))
      : Promise.resolve([]),
    include("chat") ? listChatReports(status) : Promise.resolve([]),
  ]);

  return [...content, ...listings, ...chat]
    .filter((item) => source === "all" || item.sourceType === source)
    .sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.reportId.localeCompare(b.reportId)
    )
    .slice(0, 200);
}

export async function reviewContentReport(input: {
  reportId: string;
  reviewerId: string;
  status: "reviewed" | "dismissed";
  removeTarget?: boolean;
}) {
  const db = await getDb();
  const report = await db
    .prepare(
      `SELECT id, target_type, target_id, reason, status
       FROM reports WHERE id = ?`
    )
    .bind(input.reportId)
    .first<{
      id: string;
      target_type: "post" | "comment" | "user";
      target_id: string;
      reason: string;
      status: "open" | "reviewed" | "dismissed";
    }>();
  if (!report) throw new AuthError("Report not found", 404);
  if (report.status !== "open") {
    throw new AuthError("Report already handled", 409);
  }
  let targetAlreadyRemoved = report.target_type === "user";
  if (input.removeTarget && report.target_type === "post") {
    const target = await db
      .prepare(`SELECT is_removed FROM posts WHERE id = ?`)
      .bind(report.target_id)
      .first<{ is_removed: number }>();
    targetAlreadyRemoved = !target || Boolean(target.is_removed);
  } else if (input.removeTarget && report.target_type === "comment") {
    const target = await db
      .prepare(`SELECT is_removed FROM comments WHERE id = ?`)
      .bind(report.target_id)
      .first<{ is_removed: number }>();
    targetAlreadyRemoved = !target || Boolean(target.is_removed);
  }

  const result = await db
    .prepare(
      `UPDATE reports SET status = ?
       WHERE id = ? AND status = 'open'`
    )
    .bind(input.status, input.reportId)
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new AuthError("Report already handled", 409);
  }
  if (input.status === "reviewed" && input.removeTarget && !targetAlreadyRemoved) {
    if (report.target_type === "post") {
      await removePostForModeration(report.target_id, input.reviewerId);
    } else if (report.target_type === "comment") {
      await removeCommentForModeration(report.target_id, input.reviewerId);
    }
  }

  return { ok: true as const, status: input.status };
}
