"use client";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Setting = { key: string; value: string };
type Action = Record<string, unknown>;

export function AdminSystem({ settings, recentActions }: { settings: Setting[]; recentActions: Action[] }) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  return <div className="space-y-8"><section><h1 className="font-heading text-3xl font-semibold tracking-tight">{t("admin.siteSettings")}</h1><p className="mt-2 text-sm text-muted-foreground">Change operational settings and run bounded maintenance jobs.</p></section><AdminFeedback error={error} message={message} /><section className="space-y-3"><h2 className="font-heading text-xl font-semibold">{t("admin.siteSettings")}</h2><ul className="space-y-2">{settings.map((setting) => <li key={setting.key} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"><span className="min-w-48 text-sm font-medium">{setting.key}</span><Input defaultValue={setting.value} onBlur={(event) => { if (event.target.value !== setting.value) run("set_setting", { key: setting.key, value: event.target.value }); }} aria-label={setting.key} /></li>)}</ul></section><section className="space-y-3"><h2 className="font-heading text-xl font-semibold">{t("admin.recommendations")}</h2><p className="text-sm text-muted-foreground">{t("admin.embeddingHint")}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => run("backfill_embeddings", { limit: 100 })}>{t("admin.backfillEmbeddings")}</Button><Button variant="outline" disabled={pending} onClick={() => run("backfill_translations", { limit: 100 })}>{t("admin.backfillTranslations")}</Button></div></section><section className="space-y-3"><h2 className="font-heading text-xl font-semibold">{t("admin.events")}</h2><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">When</th></tr></thead><tbody className="divide-y divide-border">{recentActions.map((action) => <tr key={String(action.id)}><td className="px-4 py-3 font-medium">{String(action.action ?? "—")}</td><td className="px-4 py-3 text-muted-foreground">{String(action.target_type ?? "user")} · {String(action.target_id ?? "—")}</td><td className="px-4 py-3 text-muted-foreground">{String(action.created_at ?? "—")}</td></tr>)}{!recentActions.length ? <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No events.</td></tr> : null}</tbody></table></div></section></div>;
}
