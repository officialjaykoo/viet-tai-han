"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type Stats = {
  postId: string;
  title: string;
  hasLink: boolean;
  score: number;
  commentCount: number;
  upvotes: number;
  downvotes: number;
  views: number;
  uniqueViewers: number;
  linkClicks: number | null;
  linkCtr: number | null;
  bySource: Array<{ source: string; views: number }>;
  byReferrer: Array<{ host: string; views: number }>;
  hourly: Array<{ hour: string; views: number }>;
  range: string;
};

function HourlyChart({
  data,
  emptyLabel,
}: {
  data: Array<{ hour: string; views: number }>;
  emptyLabel: string;
}) {
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => d.views)),
    [data]
  );

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex h-36 items-end gap-0.5 overflow-x-auto rounded-xl border border-border/50 bg-muted/20 px-2 py-2">
      {data.map((point) => {
        const height = Math.max(2, Math.round((point.views / max) * 100));
        const label = point.hour.slice(5, 13).replace("T", " ");
        return (
          <div
            key={point.hour}
            className="group relative flex min-w-1.5 flex-1 flex-col items-center justify-end"
            title={`${label} UTC · ${point.views}`}
          >
            <div
              className="w-full rounded-t-sm bg-[var(--brand)]/80 transition-colors group-hover:bg-[var(--brand)]"
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function PostStatsClient({ postId }: { postId: string }) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [range, setRange] = useState<"7d" | "30d" | "all">("7d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      const res = await apiFetch(`/api/posts/${postId}/stats?range=${range}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!cancelled) {
          setError(localizeError(data?.error, "Couldn't load analytics"));
          setStats(null);
        }
        return;
      }
      const data = (await res.json()) as Stats;
      if (!cancelled) setStats(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, range, localizeError]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["7d", "post.range7d"],
            ["30d", "post.range30d"],
            ["all", "post.rangeAll"],
          ] as const
        ).map(([id, labelKey]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={range === id ? "default" : "outline"}
            onClick={() => setRange(id)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["post.views", stats.views],
                ["post.unique", stats.uniqueViewers],
                ["post.score", stats.score],
                ["feed.comments", stats.commentCount],
                ["post.upvotes", stats.upvotes],
                ["post.downvotes", stats.downvotes],
              ] as const
            ).map(([labelKey, value]) => (
              <div
                key={labelKey}
                className="rounded-2xl border border-border/60 p-3"
              >
                <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {stats.hasLink ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("post.linkClicks")}
                </p>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {stats.linkClicks ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("post.linkCtr")}
                </p>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {stats.linkCtr ?? 0}%
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">
              {t("post.viewsByHour")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("post.viewsByHourHint")}
            </p>
            <HourlyChart
              data={stats.hourly}
              emptyLabel={t("post.noHourlyData")}
            />
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">
              {t("post.discoverySources")}
            </h2>
            <ul className="space-y-1">
              {stats.bySource.map((row) => (
                <li
                  key={row.source}
                  className="flex justify-between rounded-xl border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="capitalize">{row.source}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.views}
                  </span>
                </li>
              ))}
              {stats.bySource.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {t("post.noViewsYet")}
                </li>
              ) : null}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">
              {t("post.topReferrers")}
            </h2>
            <ul className="space-y-1">
              {stats.byReferrer.map((row) => (
                <li
                  key={row.host}
                  className="flex justify-between gap-3 rounded-xl border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{row.host}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.views}
                  </span>
                </li>
              ))}
              {stats.byReferrer.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {t("post.noReferrerData")}
                </li>
              ) : null}
            </ul>
          </section>

          <Link
            href={`/post/${postId}`}
            className="text-sm text-[var(--brand)] hover:underline"
          >
            {t("post.backToPost")}
          </Link>
        </>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : null}
    </div>
  );
}
