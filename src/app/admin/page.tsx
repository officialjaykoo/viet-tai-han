import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getRequestLocale } from "@/lib/i18n/server";
import { getAdminDashboard } from "@/lib/admin";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [{ locale }, data] = await Promise.all([getRequestLocale(), getAdminDashboard()]);

  return <AdminDashboard data={data} locale={locale} />;
}
