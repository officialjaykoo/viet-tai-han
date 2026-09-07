import { AdminSystem } from "@/components/admin/admin-system";
import { getAdminDashboard } from "@/lib/admin";
import {
  listSensitiveSiteSettingKeys,
  listSiteSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [settings, dashboard, sensitiveKeys] = await Promise.all([
    listSiteSettings(),
    getAdminDashboard(),
    listSensitiveSiteSettingKeys(),
  ]);
  return (
    <AdminSystem
      settings={settings}
      recentActions={dashboard.recentActions as Array<Record<string, unknown>>}
      sensitiveKeys={sensitiveKeys}
    />
  );
}
