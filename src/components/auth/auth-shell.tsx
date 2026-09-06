"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { PageShell } from "@/components/layout/page-shell";
import { useI18n } from "@/components/i18n/i18n-provider";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <main className="relative isolate flex-1 overflow-hidden">
      <PageShell width="narrow" className="flex min-h-full items-center py-8 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-16 -z-10 size-72 -translate-x-1/2 rounded-full bg-[var(--flag-gold)] opacity-15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-1/2 -z-10 size-40 rounded-full bg-[var(--flag-red)] opacity-[0.08] blur-3xl"
        />
        <div className="relative w-full">
          <Link
            href="/"
            aria-label={t("brand.homeAria")}
            className="group mx-auto mb-7 flex w-fit items-center rounded-2xl px-4 py-2 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <BrandLogo size="lg" />
          </Link>
          {children}
        </div>
      </PageShell>
    </main>
  );
}
