import { redirect } from "next/navigation";

import { AdminPanel } from "@/components/admin/admin-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { getAdminOverview } from "@/lib/admin";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { requireAdmin, type SessionUser } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { listSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/admin");
  }

  try {
    await requireAdmin(session.user as SessionUser);
  } catch {
    redirect("/");
  }

  const overview = await getAdminOverview();
  const settings = await listSiteSettings();
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 safe-px safe-pb py-6 sm:py-8">
        <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight">
          {tLocale(locale, "admin.title")}
        </h1>
        <AdminPanel
          initial={{
            counts: overview.counts,
            users: overview.users as Array<{
              id: string;
              username: string | null;
              name: string;
              email: string;
              role: string;
              status: string;
              karma: number;
            }>,
            bannedWords: overview.bannedWords as Array<{
              id: string;
              word: string;
              severity: string;
            }>,
            settings,
            recentActions: overview.recentActions as Array<
              Record<string, unknown>
            >,
            adCampaigns: overview.adCampaigns,
            burstPosts: overview.burstPosts,
            listingReports: overview.listingReports,
          }}
        />
      </main>
    </>
  );
}
