import { AdminReports } from "@/components/admin/admin-reports";
import {
  listReviewQueue,
  type ReviewSourceType,
} from "@/lib/review-queue";

export const dynamic = "force-dynamic";

const SOURCES = new Set<ReviewSourceType | "all">([
  "all",
  "post",
  "comment",
  "user",
  "listing",
  "business",
  "chat",
]);

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "all" ? "all" : "pending";
  const source = SOURCES.has(params.source as ReviewSourceType)
    ? (params.source as ReviewSourceType)
    : "all";
  const reports = await listReviewQueue({ status, source });
  return <AdminReports reports={reports} status={status} source={source} />;
}
