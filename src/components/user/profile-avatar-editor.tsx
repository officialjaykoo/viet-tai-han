"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DicesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import { authClient } from "@/lib/auth-client";
import { createAvatarSeed, encodeGeneratedAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export function ProfileAvatarEditor({
  username,
  image,
  compact = false,
}: {
  username: string;
  image: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState(image);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function shuffle() {
    setError(null);
    startTransition(async () => {
      const next = encodeGeneratedAvatar(createAvatarSeed());
      const { error: updateError } = await authClient.updateUser({
        image: next,
      });
      if (updateError) {
        setError(updateError.message || "Could not generate avatar");
        return;
      }
      setPreview(next);
      router.refresh();
    });
  }

  if (compact) {
    return (
      <div className="relative">
        <UserAvatar
          username={username}
          image={preview}
          size="2xl"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute right-1 bottom-1 size-8 rounded-full shadow-sm"
          disabled={pending}
          onClick={shuffle}
          aria-label={pending ? "Generating avatar" : "New avatar"}
          title="New avatar"
        >
          <DicesIcon className="size-3.5" />
        </Button>
        {error ? (
          <p
            className="absolute top-full left-0 mt-1 max-w-[10rem] text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar username={username} image={preview} size="xl" />
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("min-h-11 gap-2 sm:min-h-8")}
          disabled={pending}
          onClick={shuffle}
        >
          <DicesIcon className="size-4" />
          {pending ? "Generating…" : "New avatar"}
        </Button>
        <p className="max-w-xs text-xs text-muted-foreground">
          Shuffle a random Reddit-style avatar. Same look everywhere until you
          generate again.
        </p>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
