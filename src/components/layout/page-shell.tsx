import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const widthClasses = {
  wide: "max-w-[1240px]",
  standard: "max-w-[1152px]",
  narrow: "max-w-[768px]",
} as const;

export function PageShell({
  children,
  width = "standard",
  className,
}: {
  children: ReactNode;
  width?: keyof typeof widthClasses;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full safe-px safe-pb py-6 sm:py-8",
        widthClasses[width],
        className
      )}
    >
      {children}
    </div>
  );
}
