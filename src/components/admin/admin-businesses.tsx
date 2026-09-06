"use client";

import Link from "next/link";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

type BusinessVerification = { id: string; businessSlug: string; businessName: string; category: string; location: string; ownerUsername: string | null; ownerName: string; evidence: string; createdAt: string };

export function AdminBusinesses({ verifications }: { verifications: BusinessVerification[] }) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  return <div className="space-y-6"><section><h1 className="font-heading text-3xl font-semibold tracking-tight">{t("admin.businessVerification")}</h1><p className="mt-2 text-sm text-muted-foreground">Review pending business verification evidence.</p></section><AdminFeedback error={error} message={message} /><section className="space-y-3">{verifications.map((item) => <article key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><Link className="font-medium hover:underline" href={`/businesses/${item.businessSlug}`}>{item.businessName}</Link><span className="text-xs text-muted-foreground">{item.createdAt}</span></div><p className="text-sm text-muted-foreground">{item.category} · {item.location} · @{item.ownerUsername ?? "unknown"} ({item.ownerName})</p><div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">{t("admin.verificationEvidence")}</p><p className="whitespace-pre-wrap">{item.evidence}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending} onClick={() => run("review_business_verification", { verificationId: item.id, verificationStatus: "approved" })}>{t("admin.approveVerification")}</Button><Button size="sm" variant="destructive" disabled={pending} onClick={() => run("review_business_verification", { verificationId: item.id, verificationStatus: "rejected" })}>{t("admin.rejectVerification")}</Button></div></article>)}{!verifications.length ? <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{t("admin.noBusinessVerifications")}</p> : null}</section></div>;
}
