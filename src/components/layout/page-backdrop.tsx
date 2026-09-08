import { cn } from "@/lib/utils";

const PAGE_BACKDROP_VARIANTS = {
  default:
    "bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]",
  subtle:
    "bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]",
} as const;

export function PageBackdrop({
  variant = "default",
  className,
}: {
  variant?: keyof typeof PAGE_BACKDROP_VARIANTS;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-page-backdrop={variant}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-64",
        PAGE_BACKDROP_VARIANTS[variant],
        className
      )}
    />
  );
}
