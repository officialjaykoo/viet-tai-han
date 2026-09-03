"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiJson } from "@/lib/api-client";

type AdminUser = {
  id: string;
  username: string | null;
  name: string;
  role: string;
  status: string;
  karma: number;
};

type BannedWord = {
  id: string;
  word: string;
  severity: string;
};

type Setting = {
  key: string;
  value: string;
};

type AdCampaign = {
  id: string;
  name: string;
  status: string;
  placement: string;
  targetUrl: string;
  weight: number;
  impressions?: number;
  clicks?: number;
};

type BurstPost = {
  post_id: string;
  title: string;
  events: number;
  low_karma_events: number;
  weak_source_events: number;
};
type ListingReport = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingKind: string;
  listingStatus: string;
  reporterUsername: string | null;
  sellerUsername: string | null;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
};


export function AdminPanel({
  initial,
}: {
  initial: {
    counts: Record<string, number>;
    users: AdminUser[];
    bannedWords: BannedWord[];
    settings: Setting[];
    recentActions: Array<Record<string, unknown>>;
    adCampaigns?: AdCampaign[];
    burstPosts?: BurstPost[];
    listingReports?: ListingReport[];
  };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();
  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState<"shadow" | "block">("shadow");
  const [warnUserId, setWarnUserId] = useState("");
  const [warnMessage, setWarnMessage] = useState("");
  const [adName, setAdName] = useState("");
  const [adUrl, setAdUrl] = useState("https://");
  const [adBody, setAdBody] = useState("");
  const [adPlacement, setAdPlacement] = useState<
    "feed_inline" | "sidebar" | "post_footer"
  >("feed_inline");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const campaigns = initial.adCampaigns ?? [];
  const burstPosts = initial.burstPosts ?? [];
  const listingReports = initial.listingReports ?? [];
  const countLabels: Record<string, string> = {
    users: t("admin.users"),
    posts: t("search.posts"),
    comments: t("feed.comments"),
    subreddits: t("communities.title"),
    listings: t("search.listings"),
    open_listing_reports: t("admin.listingReports"),
    banned: t("admin.bans"),
    shadowbanned: t("admin.bans"),
    banned_words: t("admin.bannedWords"),
  };
  const placementLabels: Record<string, string> = {
    feed_inline: t("admin.feedInline"),
    sidebar: t("admin.sidebar"),
    post_footer: t("admin.postFooter"),
  };
  const statusLabels: Record<string, string> = {
    active: t("admin.activate"),
    paused: t("admin.pause"),
    ended: t("admin.end"),
  };
  const listingKindLabels: Record<string, string> = {
    market: t("marketplace.market"),
    job: t("marketplace.job"),
    service: t("marketplace.service"),
  };
  const listingStatusLabels: Record<string, string> = {
    active: t("marketplace.active"),
    sold: t("marketplace.sold"),
    closed: t("marketplace.closed"),
    removed: t("marketplace.removed"),
  };
  const reportReasonLabels: Record<string, string> = {
    scam: t("marketplace.reasonScam"),
    prohibited: t("marketplace.reasonProhibited"),
    misleading: t("marketplace.reasonMisleading"),
    unsafe: t("marketplace.reasonUnsafe"),
    other: t("marketplace.reasonOther"),
  };

  function run(op: string, payload: Record<string, unknown> = {}) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await apiFetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(data?.error, "Action failed"));
        return;
      }
      setMessage(t("admin.saved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(initial.counts).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-border/70 p-3">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {countLabels[key] ?? key.replaceAll("_", " ")}
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--brand)]" role="status">
          {message}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">{t("admin.ads")}</h2>
        <div className="space-y-2 rounded-xl border border-border/60 p-3">
          <Input
            value={adName}
            onChange={(e) => setAdName(e.target.value)}
            placeholder={t("admin.campaignName")}
          />
          <Input
            value={adUrl}
            onChange={(e) => setAdUrl(e.target.value)}
            placeholder="https://example.com"
          />
          <Textarea
            value={adBody}
            onChange={(e) => setAdBody(e.target.value)}
            placeholder={t("admin.adCopyOptional")}
            rows={2}
          />
          <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm sm:h-9"
            value={adPlacement}
            onChange={(e) =>
              setAdPlacement(
                e.target.value as "feed_inline" | "sidebar" | "post_footer"
              )
            }
          >
            <option value="feed_inline">{t("admin.feedInline")}</option>
            <option value="sidebar">{t("admin.sidebar")}</option>
            <option value="post_footer">{t("admin.postFooter")}</option>
          </select>
          <Button
            type="button"
            disabled={pending || !adName.trim() || !adUrl.trim()}
            onClick={() =>
              run("create_ad", {
                name: adName,
                targetUrl: adUrl,
                adBody,
                placement: adPlacement,
                status: "active",
                weight: 1,
              })
            }
          >
            {t("admin.createActiveCampaign")}
          </Button>
        </div>
        <ul className="space-y-2">
          {campaigns.map((campaign) => {
            const impressions = campaign.impressions ?? 0;
            const clicks = campaign.clicks ?? 0;
            const ctr =
              impressions > 0
                ? Math.round((clicks / impressions) * 10000) / 100
                : 0;
            return (
              <li
                key={campaign.id}
                className="space-y-2 rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabels[campaign.status] ?? campaign.status} ·{" "}
                      {placementLabels[campaign.placement] ?? campaign.placement} ·{" "}
                      {impressions} {t("admin.impressions")} · {clicks}{" "}
                      {t("admin.clicks")} · {ctr}% {t("admin.ctr")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {campaign.targetUrl}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["active", "admin.activate"],
                      ["paused", "admin.pause"],
                      ["ended", "admin.end"],
                    ] as const
                  ).map(([status, labelKey]) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || campaign.status === status}
                      onClick={() =>
                        run("update_ad", {
                          campaignId: campaign.id,
                          status,
                        })
                      }
                    >
                      {t(labelKey)}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
          {campaigns.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {t("admin.noCampaigns")}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          {t("admin.listingReports")}
        </h2>
        {listingReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.noListingReports")}
          </p>
        ) : (
          <ul className="space-y-2">
            {listingReports.map((report) => (
              <li
                key={report.id}
                className="space-y-3 rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a
                    href={`/marketplace/${report.listingId}`}
                    className="font-medium hover:underline"
                  >
                    {report.listingTitle}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {listingKindLabels[report.listingKind] ?? report.listingKind} ·{" "}
                  {listingStatusLabels[report.listingStatus] ?? report.listingStatus} ·{" "}
                  {t("admin.reportReason")}:{" "}
                  {reportReasonLabels[report.reason] ?? report.reason} ·{" "}
                  {t("admin.reportDetails")}: {report.details || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{report.reporterUsername ?? "unknown"} → @
                  {report.sellerUsername ?? "unknown"}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run("review_listing_report", {
                        reportId: report.id,
                        reportStatus: "reviewed",
                      })
                    }
                  >
                    {t("admin.reviewReport")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run("review_listing_report", {
                        reportId: report.id,
                        reportStatus: "dismissed",
                      })
                    }
                  >
                    {t("admin.dismissReport")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      run("review_listing_report", {
                        reportId: report.id,
                        reportStatus: "reviewed",
                        removeListing: true,
                      })
                    }
                  >
                    {t("admin.removeListing")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {burstPosts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">
            {t("admin.voteBurst")}
          </h2>
          <ul className="space-y-2">
            {burstPosts.map((post) => (
              <li
                key={post.post_id}
                className="rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <a
                  href={`/post/${post.post_id}`}
                  className="font-medium hover:underline"
                >
                  {post.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {post.events} {t("admin.events")} ·{" "}
                  {post.low_karma_events} {t("admin.lowKarma")} ·{" "}
                  {post.weak_source_events} {t("admin.weakSource")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          {t("admin.bannedWords")}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t("admin.wordOrPhrase")}
          />
          <select
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm sm:h-9"
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value as "shadow" | "block")
            }
          >
            <option value="shadow">{t("admin.shadowban")}</option>
            <option value="block">{t("admin.block")}</option>
          </select>
          <Button
            type="button"
            disabled={pending || !word.trim()}
            onClick={() => run("add_banned_word", { word, severity })}
          >
            {t("admin.add")}
          </Button>
        </div>
        <ul className="space-y-2">
          {initial.bannedWords.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{entry.word}</span>
                <span className="ml-2 text-muted-foreground">
                  {entry.severity === "shadow"
                    ? t("admin.shadowban")
                    : t("admin.block")}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run("remove_banned_word", { wordId: entry.id })
                }
              >
                {t("common.delete")}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          {t("admin.warnUser")}
        </h2>
        <Input
          value={warnUserId}
          onChange={(e) => setWarnUserId(e.target.value)}
          placeholder={t("admin.userId")}
        />
        <Textarea
          value={warnMessage}
          onChange={(e) => setWarnMessage(e.target.value)}
          placeholder={t("admin.warningMessage")}
          rows={3}
        />
        <Button
          type="button"
          disabled={pending || !warnUserId || !warnMessage.trim()}
          onClick={() =>
            run("warn", { userId: warnUserId, message: warnMessage })
          }
        >
          {t("admin.issueWarning")}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">{t("admin.users")}</h2>
        <ul className="space-y-2">
          {initial.users.map((user) => (
            <li
              key={user.id}
              className="space-y-2 rounded-xl border border-border/60 p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {user.username ? `@${user.username}` : user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.role} · {user.status} ·{" "}
                    {t("profile.karma", { count: user.karma })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["ban", "admin.ban"],
                    ["unban", "admin.unban"],
                    ["shadowban", "admin.shadowban"],
                    ["unshadowban", "admin.unshadowban"],
                  ] as const
                ).map(([action, labelKey]) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run("user_status", { userId: user.id, action })
                    }
                  >
                    {t(labelKey)}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run("delete_account", { userId: user.id })
                  }
                >
                  {t("admin.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          {t("admin.recommendations")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("admin.embeddingHint")}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const res = await apiFetch("/api/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  op: "backfill_embeddings",
                  limit: 100,
                }),
              });
              const data = (await res.json().catch(() => null)) as {
                error?: string;
                indexed?: number;
                failed?: number;
              } | null;
              if (!res.ok) {
                setError(localizeError(data?.error, t("common.error")));
                return;
              }
              setMessage(
                t("admin.indexedPosts", { count: data?.indexed ?? 0 }) +
                  (data?.failed
                    ? ` (${t("admin.failedPosts", { count: data.failed })})`
                    : "")
              );
            });
          }}
        >
          {t("admin.backfillEmbeddings")}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          {t("admin.siteSettings")}
        </h2>
        <ul className="space-y-2">
          {initial.settings.map((setting) => (
            <li
              key={setting.key}
              className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center"
            >
              <span className="min-w-48 text-sm font-medium">{setting.key}</span>
              <Input
                defaultValue={setting.value}
                onBlur={(e) => {
                  if (e.target.value !== setting.value) {
                    run("set_setting", {
                      key: setting.key,
                      value: e.target.value,
                    });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
