import { AdminAds } from "@/components/admin/admin-ads";
import { listAdCampaigns } from "@/lib/ads";

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  const campaigns = await listAdCampaigns();
  return <AdminAds campaigns={campaigns} />;
}
