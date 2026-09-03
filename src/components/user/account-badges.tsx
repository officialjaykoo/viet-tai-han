import type { AccountBadge } from "@/lib/achievement-levels";
import { cn } from "@/lib/utils";

const KARMA_STYLES: Record<string, string> = {
  new: "bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300",
  bronze:
    "bg-orange-700/15 text-orange-800 ring-orange-700/35 dark:text-orange-300",
  silver:
    "bg-slate-400/20 text-slate-700 ring-slate-400/40 dark:text-slate-200",
  gold: "bg-amber-400/20 text-amber-800 ring-amber-500/40 dark:text-amber-200",
  platinum:
    "bg-cyan-500/15 text-cyan-800 ring-cyan-500/35 dark:text-cyan-200",
  diamond:
    "bg-violet-500/15 text-violet-800 ring-violet-500/40 dark:text-violet-200",
};

const AGE_STYLES: Record<string, string> = {
  fresh: "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300",
  year1: "bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-200",
  year2: "bg-blue-500/15 text-blue-800 ring-blue-500/30 dark:text-blue-200",
  year3: "bg-indigo-500/15 text-indigo-800 ring-indigo-500/30 dark:text-indigo-200",
  year5: "bg-fuchsia-500/15 text-fuchsia-800 ring-fuchsia-500/30 dark:text-fuchsia-200",
  year10:
    "bg-[color-mix(in_oklch,var(--brand)_18%,transparent)] text-[var(--brand)] ring-[color-mix(in_oklch,var(--brand)_40%,transparent)]",
};

export function AccountBadges({
  badges,
  className,
  size = "sm",
}: {
  badges: AccountBadge[];
  className?: string;
  size?: "sm" | "md";
}) {
  if (!badges.length) return null;

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1.5", className)}
    >
      {badges.map((badge) => {
        const style =
          badge.kind === "karma"
            ? KARMA_STYLES[badge.id] ?? KARMA_STYLES.new
            : AGE_STYLES[badge.id] ?? AGE_STYLES.fresh;
        return (
          <span
            key={`${badge.kind}-${badge.id}`}
            title={badge.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-md font-semibold tracking-wide ring-1 ring-inset",
              size === "sm"
                ? "px-1.5 py-0.5 text-[10px]"
                : "px-2 py-0.5 text-xs",
              style
            )}
          >
            <span aria-hidden>{badge.kind === "karma" ? "◆" : "◎"}</span>
            {badge.label}
          </span>
        );
      })}
    </span>
  );
}
