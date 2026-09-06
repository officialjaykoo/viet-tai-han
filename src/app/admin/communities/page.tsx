import { AdminCommunities } from "@/components/admin/admin-communities";
import { listAdminCommunities } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminCommunitiesPage() {
  const communities = await listAdminCommunities({ limit: 100 });
  return <AdminCommunities communities={communities} />;
}
