"use client";

import Link from "next/link";
import { MessageSquareIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function MessagesNavIcon({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <Link
      href="/messages"
      className={cn(
        "touch-target relative inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      aria-label={t("nav.messages")}
    >
      <MessageSquareIcon className="size-5" />
    </Link>
  );
}
