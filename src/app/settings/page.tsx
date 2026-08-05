import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { getUserSettings, listBlockedUsers } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

type Section =
  | "profile"
  | "account"
  | "appearance"
  | "privacy"
  | "notifications";

function parseSection(value: string | undefined): Section {
  if (
    value === "account" ||
    value === "appearance" ||
    value === "privacy" ||
    value === "notifications" ||
    value === "profile"
  ) {
    return value;
  }
  return "profile";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/settings");
  }

  const { locale } = await getRequestLocale();
  const params = await searchParams;
  const settings = await getUserSettings(session.user.id);
  if (!settings) {
    redirect("/login?next=/settings");
  }
  const blocked = await listBlockedUsers(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 safe-px safe-pb py-6 sm:py-8">
        <div>
          <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
            {tLocale(locale, "settings.pageEyebrow")}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {tLocale(locale, "settings.pageTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tLocale(locale, "settings.pageDescription")}
          </p>
        </div>
        <SettingsClient
          initialSettings={settings}
          initialBlocked={blocked}
          initialSection={parseSection(params.section)}
        />
      </main>
    </>
  );
}
