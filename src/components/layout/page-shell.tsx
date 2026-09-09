import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const PAGE_SHELL_WIDTH_CLASSES = {
  wide: "max-w-[1240px]",
  standard: "max-w-[1024px]",
  compact: "max-w-[768px]",
} as const;

export function PageShell({
  children,
  width = "standard",
  className,
}: {
  children: ReactNode;
  width?: keyof typeof PAGE_SHELL_WIDTH_CLASSES;
  className?: string;
}) {
  return (
    <div
      data-page-width={width}
      className={cn(
        "relative mx-auto w-full safe-px safe-pb py-6 sm:py-8",
        PAGE_SHELL_WIDTH_CLASSES[width],
        className
      )}
    >
      {children}
    </div>
  );
}
