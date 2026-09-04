"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useI18n } from "@/components/i18n/i18n-provider";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <main className="relative isolate mx-auto flex w-full max-w-md flex-1 items-center overflow-hidden safe-px safe-pb py-8 sm:py-14">
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
          className="group mx-auto mb-7 flex w-fit flex-col items-center gap-3 rounded-2xl px-4 py-2 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BrandLogo size="lg" />
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className="h-1 w-8 rounded-full bg-[var(--flag-red)]" />
            <span className="h-1 w-8 rounded-full bg-[var(--flag-gold)]" />
            <span className="h-1 w-8 rounded-full bg-[var(--flag-red)]" />
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
