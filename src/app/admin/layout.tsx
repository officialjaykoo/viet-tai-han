import type { ReactNode } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin-access";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ locale }, admin] = await Promise.all([getRequestLocale(), requireAdminPage()]);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AdminHeader username={admin.username} viewSiteLabel={tLocale(locale, "admin.viewSite")} />
      <PageShell width="wide" className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 py-0 sm:py-0 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border px-4 py-6 md:block">
          <AdminNav />
        </aside>
        <main className="min-w-0 px-0 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
      </PageShell>
    </div>
  );
}
