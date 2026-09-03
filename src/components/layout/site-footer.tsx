"use client";

import { useI18n } from "@/components/i18n/i18n-provider";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto safe-pb border-t border-transparent py-4">
      <div className="mx-auto w-full max-w-3xl safe-px">
        <p className="select-none text-center text-[10px] tracking-wide text-muted-foreground/50">
          {t("brand.homeAria")} · vth.kr
        </p>
      </div>
    </footer>
  );
}
