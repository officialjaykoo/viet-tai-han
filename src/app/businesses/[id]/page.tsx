import Link from "next/link";
import { notFound } from "next/navigation";

import { BusinessBookingPanel } from "@/components/business/business-booking-panel";
import { BusinessStatusControls } from "@/components/business/business-status-controls";
import { BusinessVerificationForm } from "@/components/business/business-verification-form";
import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import type { Locale } from "@/lib/i18n/config";
import {
  getBusinessDetail,
  listBusinessBookings,
} from "@/lib/businesses";
import type {
  BusinessStatus,
  BusinessVerificationStatus,
} from "@/lib/business-constants";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function verificationLabel(locale: Locale, status: BusinessVerificationStatus) {
  const key =
    status === "verified"
      ? "business.verified"
      : status === "pending"
        ? "business.pending"
        : status === "rejected"
          ? "business.rejected"
          : "business.unverified";
  return tLocale(locale, key);
}

function statusLabel(locale: Locale, status: BusinessStatus) {
  return tLocale(locale, status === "paused" ? "business.paused" : "business.active");
}

function mapHref(business: {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const query =
    business.latitude != null && business.longitude != null
      ? `${business.latitude},${business.longitude}`
      : `${business.name}, ${business.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const business = await getBusinessDetail(id, session?.user?.id ?? null);
  if (!business) notFound();
  const { locale } = await getRequestLocale();
  const bookings = session
    ? await listBusinessBookings({
        businessId: business.id,
        viewerUserId: session.user.id,
      })
    : [];

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-4xl space-y-6 safe-px safe-pb py-6 sm:py-8">
          <Link href="/businesses" className="text-sm font-medium text-[var(--brand)] hover:underline">
            ← {tLocale(locale, "business.titlePage")}
          </Link>

          <article className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                {business.category}
              </span>
              <span>{business.location}</span>
              <span aria-hidden>·</span>
              <span>{verificationLabel(locale, business.verificationStatus)}</span>
              <span aria-hidden>·</span>
              <span>{statusLabel(locale, business.status)}</span>
            </div>
            <h1 className="mt-4 font-heading text-3xl font-semibold leading-tight text-balance sm:text-4xl">
              {business.name}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] sm:text-base">
              {business.description}
            </p>
            <div className="mt-6 grid gap-3 border-t border-border/50 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{tLocale(locale, "business.address")}</p>
                <p className="mt-1">{business.address}</p>
              </div>
              {business.openingHours ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{tLocale(locale, "business.openingHours")}</p>
                  <p className="mt-1">{business.openingHours}</p>
                </div>
              ) : null}
              {business.phone ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{tLocale(locale, "business.phone")}</p>
                  <p className="mt-1">{business.phone}</p>
                </div>
              ) : null}
              {business.websiteUrl ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{tLocale(locale, "business.website")}</p>
                  <a
                    href={business.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-[var(--brand)] hover:underline"
                  >
                    {business.websiteUrl}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <a
                href={mapHref(business)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {tLocale(locale, "business.openMap")}
              </a>
              {business.owner.username && !business.owner.isOwner ? (
                <Link
                  href={`/messages?to=${encodeURIComponent(business.owner.username)}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {tLocale(locale, "business.messageOwner")}
                </Link>
              ) : null}
              {business.owner.isOwner ? (
                <Link
                  href={`/businesses/${business.slug}/edit`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {tLocale(locale, "business.edit")}
                </Link>
              ) : null}
            </div>
          </article>

          <section className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <UserAvatar username={business.owner.username} image={business.owner.image} size="sm" className="ring-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{tLocale(locale, "business.owner")}</p>
                <p className="truncate text-sm font-medium">@{business.owner.username ?? "unknown"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-semibold">{tLocale(locale, "business.services")}</h2>
            {business.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tLocale(locale, "business.noServices")}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {business.services.map((service) => (
                  <li key={service.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{service.name}</h3>
                      <span className="shrink-0 text-xs text-muted-foreground">{service.durationMinutes} min</span>
                    </div>
                    {service.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                    ) : null}
                    {service.price ? <p className="mt-3 text-sm font-medium">{service.price}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {business.owner.isOwner ? (
            <>
              <BusinessStatusControls businessId={business.id} status={business.status} />
              {business.verificationStatus === "verified" ? (
                <p className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                  {tLocale(locale, "business.verificationApproved")}
                </p>
              ) : (
                <BusinessVerificationForm
                  businessId={business.id}
                  latestVerification={business.latestVerification}
                />
              )}
            </>
          ) : null}

          <BusinessBookingPanel
            businessId={business.id}
            services={business.services}
            bookings={bookings}
            authenticated={Boolean(session)}
            verified={business.verificationStatus === "verified" && business.status === "active"}
            isOwner={business.owner.isOwner}
          />
        </div>
      </main>
    </>
  );
}
