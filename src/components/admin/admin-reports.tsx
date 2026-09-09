"use client";

import Link from "next/link";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type {
  ReviewQueueItem,
  ReviewSourceType,
} from "@/lib/review-queue";

type SourceFilter = ReviewSourceType | "all";

const sourceOptions: Array<{ id: SourceFilter; label: string }> = [
  { id: "all", label: "All sources" },
  { id: "post", label: "Posts" },
  { id: "comment", label: "Comments" },
  { id: "user", label: "Users" },
  { id: "listing", label: "Listings" },
  { id: "business", label: "Businesses" },
  { id: "chat", label: "Chat" },
];

export function AdminReports({
  reports,
  status,
  source,
}: {
  reports: ReviewQueueItem[];
  status: "pending" | "all";
  source: SourceFilter;
}) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();

  function review(report: ReviewQueueItem, removeTarget = false) {
    if (report.sourceType === "post" || report.sourceType === "comment" || report.sourceType === "user") {
      run("review_content_report", {
        reportId: report.reportId,
        reportStatus: "reviewed",
        removeTarget,
      });
    } else if (report.sourceType === "listing") {
      run("review_listing_report", {
        reportId: report.reportId,
        reportStatus: "reviewed",
        removeListing: removeTarget,
      });
    } else if (report.chatReportType === "message") {
      run("review_chat_message_report", {
        reportId: report.reportId,
        reportStatus: "reviewed",
        removeMessage: removeTarget,
      });
    } else {
      run("review_chat_room_report", {
        reportId: report.reportId,
        reportStatus: "reviewed",
      });
    }
  }

  function dismiss(report: ReviewQueueItem) {
    const payload = { reportId: report.reportId, reportStatus: "dismissed" };
    if (report.sourceType === "post" || report.sourceType === "comment" || report.sourceType === "user") {
      run("review_content_report", payload);
    } else if (report.sourceType === "listing") {
      run("review_listing_report", payload);
    } else if (report.chatReportType === "message") {
      run("review_chat_message_report", payload);
    } else {
      run("review_chat_room_report", payload);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t("admin.reviewQueue")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("admin.reviewQueueDescription")}
        </p>
      </section>
      <nav className="flex flex-wrap gap-2" aria-label={t("admin.reportStatus")}>
        <Link
          href={`/admin/reports?status=pending${source === "all" ? "" : `&source=${source}`}`}
          className={status === "pending" ? "rounded-full bg-foreground px-3 py-2 text-sm text-background" : "rounded-full border border-border px-3 py-2 text-sm"}
        >
          {t("admin.pending")}
        </Link>
        <Link
          href={`/admin/reports?status=all${source === "all" ? "" : `&source=${source}`}`}
          className={status === "all" ? "rounded-full bg-foreground px-3 py-2 text-sm text-background" : "rounded-full border border-border px-3 py-2 text-sm"}
        >
          {t("admin.all")}
        </Link>
      </nav>
      <div className="flex flex-wrap gap-2" aria-label={t("admin.reviewSource")}>
        {sourceOptions.map((option) => (
          <Link
            key={option.id}
            href={`/admin/reports?status=${status}${option.id === "all" ? "" : `&source=${option.id}`}`}
            className={source === option.id ? "font-semibold text-[var(--brand)]" : "text-muted-foreground"}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <AdminFeedback error={error} message={message} />
      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("admin.noReviewReports")}
        </p>
      ) : (
        <section className="space-y-3" aria-label={t("admin.reviewQueue")}>
          {reports.map((report) => {
            const open = report.status === "pending";
            const removable =
              report.sourceType === "post" ||
              report.sourceType === "comment" ||
              report.sourceType === "listing" ||
              report.chatReportType === "message";
            return (
              <article key={`${report.sourceType}-${report.reportId}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {report.sourceType}
                    </p>
                    {report.targetHref ? (
                      <Link href={report.targetHref} className="mt-1 block font-medium hover:text-[var(--brand)]">
                        {report.targetSummary}
                      </Link>
                    ) : (
                      <p className="mt-1 font-medium">{report.targetSummary}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {report.reason} · {report.reporterUsername ?? "unknown"} · {report.createdAt}
                    </p>
                    {report.details ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {report.details}
                      </p>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="flex flex-wrap gap-2">
                      {removable ? (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(report, true)}>
                          {t("admin.removeTarget")}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => review(report)}>
                        {t("admin.reviewReport")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => dismiss(report)}>
                        {t("admin.dismissReport")}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{report.status}</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
