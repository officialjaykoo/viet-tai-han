"use client";

import { useState } from "react";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AdCampaign = { id: string; name: string; status: string; placement: string; targetUrl: string; impressions?: number; clicks?: number };

export function AdminAds({ campaigns }: { campaigns: AdCampaign[] }) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("https://");
  const [body, setBody] = useState("");
  const [placement, setPlacement] = useState<"feed_inline" | "sidebar" | "post_footer">("feed_inline");
  return <div className="space-y-6"><section><h1 className="font-heading text-3xl font-semibold tracking-tight">{t("admin.ads")}</h1><p className="mt-2 text-sm text-muted-foreground">Create campaigns and manage placement lifecycle.</p></section><AdminFeedback error={error} message={message} /><section className="space-y-3 rounded-xl border border-border bg-card p-5"><h2 className="font-heading text-xl font-semibold">{t("admin.createActiveCampaign")}</h2><div className="grid gap-3 sm:grid-cols-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("admin.campaignName")} aria-label={t("admin.campaignName")} /><Input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://example.com" aria-label="Target URL" /><Textarea className="sm:col-span-2" value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("admin.adCopyOptional")} aria-label={t("admin.adCopyOptional")} /><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={placement} onChange={(event) => setPlacement(event.target.value as typeof placement)} aria-label={t("admin.ads")}><option value="feed_inline">{t("admin.feedInline")}</option><option value="sidebar">{t("admin.sidebar")}</option><option value="post_footer">{t("admin.postFooter")}</option></select><div><Button disabled={pending || !name.trim() || !targetUrl.trim()} onClick={() => run("create_ad", { name, targetUrl, adBody: body, placement, status: "active", weight: 1 })}>{t("admin.createActiveCampaign")}</Button></div></div></section><section className="space-y-3"><h2 className="font-heading text-xl font-semibold">{t("admin.ads")}</h2>{campaigns.map((campaign) => { const impressions = campaign.impressions ?? 0; const clicks = campaign.clicks ?? 0; const ctr = impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0; return <article key={campaign.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{campaign.name}</p><p className="mt-1 text-sm text-muted-foreground">{campaign.status} · {campaign.placement} · {impressions} {t("admin.impressions")} · {clicks} {t("admin.clicks")} · {ctr}% {t("admin.ctr")}</p><p className="mt-1 truncate text-xs text-muted-foreground">{campaign.targetUrl}</p></div><div className="flex flex-wrap gap-2">{(["active", "paused", "ended"] as const).map((status) => <Button key={status} size="sm" variant="outline" disabled={pending || campaign.status === status} onClick={() => run("update_ad", { campaignId: campaign.id, status })}>{t(status === "active" ? "admin.activate" : status === "paused" ? "admin.pause" : "admin.end")}</Button>)}</div></div></article>; })}{!campaigns.length ? <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{t("admin.noCampaigns")}</p> : null}</section></div>;
}
