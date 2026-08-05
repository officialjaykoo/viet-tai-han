"use client";

import {
  BanIcon,
  EllipsisIcon,
  EyeOffIcon,
  FlagIcon,
  UserRoundIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate / discrimination" },
  { value: "misinformation", label: "Misinformation" },
  { value: "nsfw", label: "Sexual / NSFW" },
  { value: "other", label: "Other" },
] as const;

type PostOverflowMenuProps = {
  postId: string;
  authorUsername: string;
  onDismiss?: () => void;
};

export function PostOverflowMenu({
  postId,
  authorUsername,
  onDismiss,
}: PostOverflowMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requireAuth(status: number) {
    if (status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/post/${postId}`)}`);
      return true;
    }
    return false;
  }

  function hide() {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/posts/${postId}/hide`, { method: "POST" });
      if (requireAuth(res.status)) return;
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not hide post");
        return;
      }
      setMessage("Hidden from your feeds");
      onDismiss?.();
      router.refresh();
    });
  }

  function blockAuthor() {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(
        `/api/users/${encodeURIComponent(authorUsername)}`,
        {
          method: "POST",
          body: JSON.stringify({ action: "block" }),
        }
      );
      if (requireAuth(res.status)) return;
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not block user");
        return;
      }
      setMessage(`Blocked u/${authorUsername}`);
      onDismiss?.();
      router.refresh();
    });
  }

  function report(reason: string) {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (requireAuth(res.status)) return;
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not submit report");
        return;
      }
      setMode("menu");
      setMessage("Report submitted");
    });
  }

  return (
    <div className="relative shrink-0">
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) {
            setMode("menu");
            setError(null);
          }
        }}
      >
        <DropdownMenuTrigger
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
          aria-label="Post options"
          disabled={pending}
        >
          <EllipsisIcon className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-52 w-52">
          {mode === "menu" ? (
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="min-h-11"
                disabled={pending}
                onClick={hide}
              >
                <EyeOffIcon />
                Not interested
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                disabled={pending}
                onClick={() => setMode("report")}
              >
                <FlagIcon />
                Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11"
                variant="destructive"
                disabled={pending}
                onClick={blockAuthor}
              >
                <BanIcon />
                Block u/{authorUsername}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                render={
                  <a href={`/u/${encodeURIComponent(authorUsername)}`} />
                }
              >
                <UserRoundIcon />
                View profile
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <>
              <DropdownMenuLabel>Why are you reporting?</DropdownMenuLabel>
              <DropdownMenuGroup>
                {REPORT_REASONS.map((reason) => (
                  <DropdownMenuItem
                    key={reason.value}
                    className="min-h-11"
                    disabled={pending}
                    onClick={() => report(reason.value)}
                  >
                    {reason.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11"
                onClick={() => setMode("menu")}
              >
                Back
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {message ? (
        <p className="absolute top-full right-0 mt-1 whitespace-nowrap text-[11px] text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="absolute top-full right-0 mt-1 max-w-40 text-right text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
