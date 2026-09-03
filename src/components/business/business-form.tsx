"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessDetail } from "@/lib/businesses";
import { apiFetch } from "@/lib/api-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

type ServiceDraft = {
  name: string;
  description: string;
  price: string;
  durationMinutes: number;
};

function emptyService(): ServiceDraft {
  return { name: "", description: "", price: "", durationMinutes: 60 };
}

export function BusinessForm({ initial }: { initial?: BusinessDetail }) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [latitude, setLatitude] = useState(
    initial?.latitude == null ? "" : String(initial.latitude)
  );
  const [longitude, setLongitude] = useState(
    initial?.longitude == null ? "" : String(initial.longitude)
  );
  const [openingHours, setOpeningHours] = useState(initial?.openingHours ?? "");
  const [services, setServices] = useState<ServiceDraft[]>(
    initial?.services.map((service) => ({
      name: service.name,
      description: service.description,
      price: service.price ?? "",
      durationMinutes: service.durationMinutes,
    })) ?? [emptyService()]
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  function updateService(index: number, patch: Partial<ServiceDraft>) {
    setServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, ...patch } : service
      )
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    bot.markTrusted(event);
    setError(null);
    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }
      const payload = bot.attachToPayload({
        name,
        description,
        category,
        address,
        location,
        phone: phone.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        openingHours: openingHours.trim() || null,
        services: services
          .filter((service) => service.name.trim())
          .map((service) => ({
            name: service.name,
            description: service.description,
            price: service.price.trim() || null,
            durationMinutes: Number(service.durationMinutes),
          })),
      });
      const endpoint = initial ? `/api/businesses/${initial.id}` : "/api/businesses";
      const res = await apiFetch(endpoint, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(initial ? `/businesses/${initial.slug}/edit` : "/businesses/new")}`);
        return;
      }
      if (!res.ok) {
        const response = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(response?.error, t("business.createFailed")));
        return;
      }
      const result = (await res.json()) as { slug: string };
      router.push(`/businesses/${result.slug}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="relative space-y-5"
      data-hydrated={hydrated}
    >
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="business-name" className="text-sm font-medium">
            {t("business.name")}
          </label>
          <Input
            id="business-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("business.namePlaceholder")}
            maxLength={100}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="business-category" className="text-sm font-medium">
            {t("business.category")}
          </label>
          <Input
            id="business-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t("business.categoryPlaceholder")}
            maxLength={80}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="business-location" className="text-sm font-medium">
            {t("business.location")}
          </label>
          <Input
            id="business-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t("business.locationPlaceholder")}
            maxLength={100}
            required
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="business-description" className="text-sm font-medium">
          {t("business.description")}
        </label>
        <Textarea
          id="business-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("business.descriptionPlaceholder")}
          maxLength={5_000}
          rows={6}
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="business-address" className="text-sm font-medium">
          {t("business.address")}
        </label>
        <Input
          id="business-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={t("business.addressPlaceholder")}
          maxLength={200}
          required
          disabled={pending}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="business-phone" className="text-sm font-medium">
            {t("business.phone")}
          </label>
          <Input
            id="business-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("business.phonePlaceholder")}
            maxLength={40}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="business-website" className="text-sm font-medium">
            {t("business.website")}
          </label>
          <Input
            id="business-website"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://"
            maxLength={300}
            type="url"
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="business-hours" className="text-sm font-medium">
          {t("business.openingHours")}
        </label>
        <Input
          id="business-hours"
          value={openingHours}
          onChange={(event) => setOpeningHours(event.target.value)}
          placeholder={t("business.openingHoursPlaceholder")}
          maxLength={500}
          disabled={pending}
        />
      </div>

      <fieldset className="space-y-3 rounded-2xl border border-border/60 p-4">
        <legend className="px-1 text-sm font-medium">{t("business.map")}</legend>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("business.mapHint")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            aria-label={t("business.latitude")}
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="37.5665"
            inputMode="decimal"
            disabled={pending}
          />
          <Input
            aria-label={t("business.longitude")}
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="126.9780"
            inputMode="decimal"
            disabled={pending}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-border/60 p-4">
        <legend className="px-1 text-sm font-medium">{t("business.services")}</legend>
        {services.map((service, index) => (
          <div key={index} className="space-y-3 rounded-xl bg-muted/35 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Input
                aria-label={`${t("business.serviceName")} ${index + 1}`}
                value={service.name}
                onChange={(event) => updateService(index, { name: event.target.value })}
                placeholder={t("business.serviceNamePlaceholder")}
                maxLength={100}
                disabled={pending}
              />
              <Input
                aria-label={`${t("business.duration")} ${index + 1}`}
                type="number"
                min={15}
                max={480}
                step={15}
                value={service.durationMinutes}
                onChange={(event) =>
                  updateService(index, {
                    durationMinutes: Number(event.target.value),
                  })
                }
                placeholder={t("business.durationPlaceholder")}
                disabled={pending}
              />
            </div>
            <Textarea
              aria-label={`${t("business.serviceDescription")} ${index + 1}`}
              value={service.description}
              onChange={(event) =>
                updateService(index, { description: event.target.value })
              }
              placeholder={t("business.serviceDescriptionPlaceholder")}
              maxLength={500}
              rows={2}
              disabled={pending}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label={`${t("business.servicePrice")} ${index + 1}`}
                value={service.price}
                onChange={(event) => updateService(index, { price: event.target.value })}
                placeholder={t("business.servicePricePlaceholder")}
                maxLength={80}
                disabled={pending}
              />
              {services.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    setServices((current) => current.filter((_, item) => item !== index))
                  }
                >
                  {t("business.removeService")}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {services.length < 20 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setServices((current) => [...current, emptyService()])}
          >
            {t("business.addService")}
          </Button>
        ) : null}
      </fieldset>

      <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("business.contactHint")}
      </p>
      <TurnstileWidget onToken={setTurnstileToken} resetRef={turnstileReset} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={
          !hydrated ||
          pending ||
          !name.trim() ||
          !description.trim() ||
          !category.trim() ||
          !address.trim() ||
          !location.trim() ||
          requiresTurnstileToken(turnstileToken)
        }
      >
        {pending
          ? t("business.saving")
          : initial
            ? t("business.saveChanges")
            : t("business.create")}
      </Button>
    </form>
  );
}
