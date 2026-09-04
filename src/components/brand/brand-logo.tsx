import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const markSize = {
  sm: "size-9 rounded-[0.7rem] text-2xl",
  md: "size-10 rounded-xl text-[1.75rem]",
  lg: "size-[4.5rem] rounded-[1.35rem] text-[3.5rem]",
} as const;

const wordmarkSize = {
  sm: "text-[0.9rem]",
  md: "text-[1.08rem] sm:text-[1.2rem]",
  lg: "text-[2rem] sm:text-[2.25rem]",
} as const;

/** Vietnamese flag colors expressed as a compact, readable VTH wordmark. */
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center bg-[var(--flag-red)] font-black leading-none tracking-[-0.12em] text-[var(--flag-gold)] shadow-[0_12px_28px_-14px_var(--flag-red)]",
          markSize[size]
        )}
      >
        V
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-[0.28em] font-heading font-extrabold leading-none tracking-[-0.045em]",
          wordmarkSize[size]
        )}
      >
        <span className="text-[var(--flag-red)]">viet</span>
        <span className="text-[var(--flag-gold-text)]">tai</span>
        <span className="text-[var(--brand-ink)]">han</span>
      </span>
    </span>
  );
}
