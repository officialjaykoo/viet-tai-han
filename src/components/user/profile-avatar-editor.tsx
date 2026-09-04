"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  CameraIcon,
  DicesIcon,
  ImageIcon,
  RotateCcwIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import { createAvatarSeed, encodeGeneratedAvatar } from "@/lib/avatar";
import { apiFetch } from "@/lib/api-client";

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

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
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [preview, setPreview] = useState(image);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.set("file", file);
    const res = await apiFetch("/api/media", { method: "POST", body: form });
    const data = (await res.json()) as { mediaKey?: string; error?: string };
    if (!res.ok || !data.mediaKey) {
      throw new Error(data.error ?? "Upload failed");
    }
    return data.mediaKey;
  }

  async function persistImage(next: string | null) {
    const res = await apiFetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "profile", image: next }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!res.ok) {
      throw new Error(data?.error ?? "Could not save avatar");
    }
    setPreview(next);
    router.refresh();
  }

  function runImageUpdate(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await persistImage(next);
      } catch (err) {
        setError(
          localizeError(
            err instanceof Error ? err.message : null,
            t("common.error")
          )
        );
      }
    });
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const key = await uploadFile(file);
        await persistImage(`/api/media/${key}`);
      } catch (err) {
        setError(
          localizeError(
            err instanceof Error ? err.message : null,
            t("common.error")
          )
        );
      }
    });
  }

  function renderInputs() {
    return (
      <>
        <input
          ref={cameraInput}
          type="file"
          accept={AVATAR_ACCEPT}
          capture="user"
          aria-label={t("settings.takePhoto")}
          className="sr-only"
          onChange={(event) => {
            chooseFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept={AVATAR_ACCEPT}
          aria-label={t("settings.chooseFromGallery")}
          className="sr-only"
          onChange={(event) => {
            chooseFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </>
    );
  }

  if (compact) {
    return (
      <div className="relative">
        <UserAvatar username={username} image={preview} size="2xl" />
        {renderInputs()}
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="absolute right-1 bottom-1 inline-flex size-8 items-center justify-center rounded-full bg-background text-foreground shadow-sm outline-none ring-1 ring-border/70 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
            disabled={pending}
            aria-label={
              pending ? t("settings.saving") : t("settings.changeAvatar")
            }
            title={t("settings.changeAvatar")}
          >
            <CameraIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-52">
            <DropdownMenuItem
              className="min-h-11"
              onClick={() => cameraInput.current?.click()}
            >
              <CameraIcon />
              {t("settings.takePhoto")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              onClick={() => galleryInput.current?.click()}
            >
              <ImageIcon />
              {t("settings.chooseFromGallery")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              onClick={() => runImageUpdate(null)}
            >
              <RotateCcwIcon />
              {t("settings.defaultAvatar")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              onClick={() =>
                runImageUpdate(encodeGeneratedAvatar(createAvatarSeed()))
              }
            >
              <DicesIcon />
              {t("settings.shuffleAvatar")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {error ? (
          <p
            className="absolute top-full left-0 mt-1 max-w-[12rem] text-xs text-destructive"
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
        {renderInputs()}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            disabled={pending}
            onClick={() => cameraInput.current?.click()}
          >
            <CameraIcon className="size-4" />
            {t("settings.takePhoto")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            disabled={pending}
            onClick={() => galleryInput.current?.click()}
          >
            <ImageIcon className="size-4" />
            {t("settings.chooseFromGallery")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            disabled={pending}
            onClick={() => runImageUpdate(null)}
          >
            <RotateCcwIcon className="size-4" />
            {t("settings.defaultAvatar")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            disabled={pending}
            onClick={() =>
              runImageUpdate(encodeGeneratedAvatar(createAvatarSeed()))
            }
          >
            <DicesIcon className="size-4" />
            {t("settings.shuffleAvatar")}
          </Button>
        </div>
        <p className="max-w-xs text-xs text-muted-foreground">
          {t("settings.avatarHelp")}
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
