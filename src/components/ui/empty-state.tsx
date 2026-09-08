import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  action,
  as = "div",
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  as?: "div" | "li";
  className?: string;
}) {
  const Component = as;

  return (
    <Component
      className={cn(
        "rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <div>{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Component>
  );
}
