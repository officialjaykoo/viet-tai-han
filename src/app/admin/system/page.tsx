import { AdminSystem } from "@/components/admin/admin-system";
import { getAdminDashboard } from "@/lib/admin";
import { listSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [settings, dashboard] = await Promise.all([listSiteSettings(), getAdminDashboard()]);
  return <AdminSystem settings={settings} recentActions={dashboard.recentActions as Array<Record<string, unknown>>} />;
}
