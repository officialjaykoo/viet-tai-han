"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessBooking, BusinessService } from "@/lib/businesses";
import { apiFetch } from "@/lib/api-client";

function localDateTimeValue(timestamp: number) {
  const date = new Date(timestamp - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function bookingStatusKey(status: BusinessBooking["status"]) {
  return `business.${status}` as const;
}

export function BusinessBookingPanel({
  businessId,
  services,
  bookings,
  authenticated,
  verified,
  isOwner,
}: {
  businessId: string;
  services: BusinessService[];
  bookings: BusinessBooking[];
  authenticated: boolean;
  verified: boolean;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/businesses";
  const localizeError = useLocalizedError();
  const [pending, startTransition] = useTransition();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [startAt, setStartAt] = useState("");
  const [note, setNote] = useState("");
  const [minStartAt, setMinStartAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ownerView = isOwner;

  useEffect(() => {
    setMinStartAt(localDateTimeValue(Date.now() + 15 * 60_000));
  }, []);

  function requestBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!startAt) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const parsed = new Date(startAt);
      const res = await apiFetch(`/api/businesses/${businessId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: serviceId || null,
          startAt: parsed.toISOString(),
          note: note.trim() || null,
        }),
      });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(pathname)}`;
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("business.bookingFailed")));
        return;
      }
      setStartAt("");
      setNote("");
      setMessage(t("business.bookingRequested"));
      window.location.reload();
    });
  }

  function updateBooking(id: string, status: "confirmed" | "declined" | "cancelled" | "completed") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/business-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, t("business.bookingFailed")));
        return;
      }
      window.location.reload();
    });
  }

  if (!authenticated) {
    return (
      <section className="space-y-2 rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
        <h2 className="font-heading text-lg font-semibold">{t("business.bookingTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("business.bookingHint")}</p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
        >
          {t("nav.logIn")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {ownerView ? t("business.myBookings") : t("business.bookingTitle")}
        </h2>
        {!ownerView ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {verified ? t("business.bookingHint") : t("business.bookingNotVerified")}
          </p>
        ) : null}
      </div>

      {!ownerView && verified ? (
        <form onSubmit={requestBooking} className="space-y-3">
          {services.length > 0 ? (
            <div className="space-y-1.5">
              <label htmlFor="booking-service" className="text-sm font-medium">
                {t("business.bookingService")}
              </label>
              <select
                id="booking-service"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
                disabled={pending}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-9 sm:text-sm"
              >
                <option value="">{t("business.chooseService")}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} min
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("business.noServices")}</p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="booking-start" className="text-sm font-medium">
              {t("business.bookingTime")}
            </label>
            <input
              id="booking-start"
              type="datetime-local"
              value={startAt}
              min={minStartAt}
              onChange={(event) => setStartAt(event.target.value)}
              required
              disabled={pending}
              className="flex h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-9 sm:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="booking-note" className="text-sm font-medium">
              {t("business.bookingNote")}
            </label>
            <Textarea
              id="booking-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("business.bookingNotePlaceholder")}
              maxLength={1_000}
              rows={3}
              disabled={pending}
            />
          </div>
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
          <Button type="submit" disabled={pending || !startAt}>
            {pending ? t("business.bookingSubmitting") : t("business.requestBooking")}
          </Button>
        </form>
      ) : null}

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("business.noBookings")}</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((booking) => (
            <li key={booking.id} className="space-y-2 rounded-xl border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {new Date(booking.startAt).toLocaleString()}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {t(bookingStatusKey(booking.status))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {booking.serviceName ?? t("business.services")} · {booking.durationMinutes} min
              </p>
              <p className="text-xs text-muted-foreground">
                {ownerView
                  ? `${t("business.customer")}: @${booking.requesterUsername ?? "unknown"}`
                  : `${t("business.owner")}: ${booking.businessName}`}
              </p>
              {booking.note ? (
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{booking.note}</p>
              ) : null}
              {ownerView && booking.status === "requested" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => updateBooking(booking.id, "confirmed")}
                  >
                    {t("business.confirmBooking")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => updateBooking(booking.id, "declined")}
                  >
                    {t("business.declineBooking")}
                  </Button>
                </div>
              ) : null}
              {ownerView && booking.status === "confirmed" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => updateBooking(booking.id, "completed")}
                >
                  {t("business.completeBooking")}
                </Button>
              ) : null}
              {!ownerView && ["requested", "confirmed"].includes(booking.status) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => updateBooking(booking.id, "cancelled")}
                >
                  {t("business.cancelBooking")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
