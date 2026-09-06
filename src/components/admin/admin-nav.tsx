"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";

const navigation = [
  ["/admin", "dashboard"],
  ["/admin/communities", "communities"],
  ["/admin/users", "users"],
  ["/admin/moderation", "moderation"],
  ["/admin/reports", "reports"],
  ["/admin/businesses", "businesses"],
  ["/admin/ads", "ads"],
  ["/admin/system", "system"],
] as const;

export function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return <nav aria-label={t("admin.title")} className={mobile ? "flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden" : "sticky top-20 space-y-1 text-sm"}>{navigation.map(([href, key]) => { const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)); const label = key === "dashboard" ? t("admin.dashboard") : key === "communities" ? t("communities.title") : key === "users" ? t("admin.users") : key === "moderation" ? t("admin.bannedWords") : key === "reports" ? t("admin.listingReports") : key === "businesses" ? t("nav.businesses") : key === "ads" ? t("admin.ads") : t("admin.siteSettings"); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={[mobile ? "shrink-0 rounded-md px-3 py-2" : "block rounded-md px-3 py-2", "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", active ? "bg-muted font-semibold text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"].join(" ")}>{label}</Link>; })}</nav>;
}
