import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import { tLocale } from "@/lib/i18n/translate";

export type AdminDashboardData = { counts: Record<string, number>; recentActions: Array<Record<string, unknown>> };

const cards = [
  ["users", "admin.users", "/admin/users"],
  ["communities", "communities.title", "/admin/communities"],
  ["posts", "search.posts", "/admin"],
  ["comments", "feed.comments", "/admin"],
  ["businesses", "nav.businesses", "/admin/businesses"],
  ["listings", "admin.listingReports", "/admin/reports"],
] as const;

export function AdminDashboard({ data, locale }: { data: AdminDashboardData; locale: Locale }) {
  const attention = [["marketplace_reports", tLocale(locale, "admin.listingReports"), "/admin/reports"], ["message_reports", tLocale(locale, "admin.chatReports"), "/admin/reports"], ["business_verifications", tLocale(locale, "admin.businessVerification"), "/admin/businesses"]] as const;
  return <div className="space-y-8"><section><p className="text-sm font-medium text-muted-foreground">VTH Admin</p><h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{tLocale(locale, "admin.dashboard")}</h1><p className="mt-2 text-sm text-muted-foreground">{tLocale(locale, "admin.overview")}</p></section><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([key, labelKey, href]) => <Link key={key} href={href} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"><p className="text-sm text-muted-foreground">{tLocale(locale, labelKey)}</p><p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{data.counts[key] ?? 0}</p></Link>)}</section><section className="space-y-3"><h2 className="font-heading text-xl font-semibold">{tLocale(locale, "admin.needsAttention")}</h2><div className="grid gap-3 sm:grid-cols-3">{attention.map(([key, label, href]) => <Link key={key} href={href} className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 transition-colors hover:bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{data.counts[key] ?? 0}</p></Link>)}</div></section><section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="font-heading text-xl font-semibold">{tLocale(locale, "admin.recentActivity")}</h2><Link className="text-sm font-medium text-primary hover:underline" href="/admin/system">{tLocale(locale, "admin.events")}</Link></div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{tLocale(locale, "admin.action")}</th><th className="px-4 py-3">{tLocale(locale, "admin.target")}</th><th className="px-4 py-3">{tLocale(locale, "admin.when")}</th></tr></thead><tbody className="divide-y divide-border">{data.recentActions.length ? data.recentActions.map((action) => <tr key={String(action.id)}><td className="px-4 py-3 font-medium">{String(action.action ?? "—")}</td><td className="px-4 py-3 text-muted-foreground">{String(action.target_type ?? "user")} · {String(action.target_id ?? "—")}</td><td className="px-4 py-3 text-muted-foreground">{String(action.created_at ?? "—")}</td></tr>) : <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={3}>{tLocale(locale, "admin.noRecentActivity")}</td></tr>}</tbody></table></div></section></div>;
}
