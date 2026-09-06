import { AdminReports } from "@/components/admin/admin-reports";
import { listChatMessageReports, listChatRoomReports } from "@/lib/dm-moderation";
import { listListingReportQueue } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const [listingReports, messageReports, roomReports] = await Promise.all([
    listListingReportQueue("open"),
    listChatMessageReports("open"),
    listChatRoomReports("open"),
  ]);
  return <AdminReports listingReports={listingReports} chatReports={[...messageReports, ...roomReports]} />;
}
