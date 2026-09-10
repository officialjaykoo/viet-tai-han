"use client";

import {
  ChevronsUpDownIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import {
  MAX_POST_BODY_LENGTH,
  MAX_POST_TITLE_LENGTH,
  MAX_POST_URL_LENGTH,
} from "@/lib/post-limits";
import { prepareImageForUpload } from "@/lib/prepare-image";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { apiFetch } from "@/lib/api-client";

type PostType = "text" | "image" | "link";

type CommunityOption = {
  name: string;
  title: string;
  subscriberCount: number;
};

type Destination = {
  kind: "community";
  name: string;
  title: string;
};

const POST_TYPES: {
  id: PostType;
  icon: typeof FileTextIcon;
}[] = [
  { id: "text", icon: FileTextIcon },
  { id: "image", icon: ImageIcon },
  { id: "link", icon: Link2Icon },
];

type DraftFingerprint = {
  value: string;
  imageFile: File | null;
};

function createDraftFingerprint(input: {
  postType: PostType;
  destination: Destination | null;
  title: string;
  body: string;
  url: string;
  imageFile: File | null;
}): string {
  return JSON.stringify([
    input.postType,
    input.destination?.kind ?? null,
    input.destination?.kind === "community"
      ? input.destination.name
      : null,
    input.title,
    input.postType === "text" ? input.body : "",
    input.postType === "link" ? input.url : "",
    input.postType === "image" && input.imageFile
      ? [
          input.imageFile.name,
          input.imageFile.size,
          input.imageFile.lastModified,
          input.imageFile.type,
        ]
      : null,
  ]);
}

const fieldRadius = "rounded-lg";

export function CreatePostForm({
  defaultSubreddit = "",
  defaultPostType = "text",
}: {
  defaultSubreddit?: string;
  defaultPostType?: PostType;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();

  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<string | null>(null);
  const mediaKeyRef = useRef<string | null>(null);
  const draftFingerprintRef = useRef<DraftFingerprint | null>(null);
  const currentDraftRef = useRef<DraftFingerprint>({
    value: "",
    imageFile: null,
  });
  const listId = useId();

  const [postType, setPostType] = useState<PostType>(defaultPostType);
  const [destination, setDestination] = useState<Destination | null>(
    defaultSubreddit
      ? { kind: "community", name: defaultSubreddit, title: defaultSubreddit }
      : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [communityQuery, setCommunityQuery] = useState("");
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const currentDraftFingerprint = createDraftFingerprint({
    postType,
    destination,
    title,
    body,
    url,
    imageFile,
  });

  useEffect(() => {
    const previous = draftFingerprintRef.current;
    if (
      previous !== null &&
      (previous.value !== currentDraftFingerprint ||
        previous.imageFile !== imageFile)
    ) {
      requestIdRef.current = null;
      mediaKeyRef.current = null;
    }
    draftFingerprintRef.current = {
      value: currentDraftFingerprint,
      imageFile,
    };
    currentDraftRef.current = {
      value: currentDraftFingerprint,
      imageFile,
    };
  }, [
    body,
    currentDraftFingerprint,
    destination,
    imageFile,
    postType,
    title,
    url,
  ]);


  const loadCommunities = useCallback(async (query: string) => {
    setLoadingCommunities(true);
    try {
      const res = await apiFetch(
        `/api/search?type=communities&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { communities?: CommunityOption[] };
      setCommunities(data.communities ?? []);
    } catch {
      // Keep previous suggestions
    } finally {
      setLoadingCommunities(false);
    }
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = window.setTimeout(() => {
      void loadCommunities(communityQuery);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [communityQuery, loadCommunities, pickerOpen]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectCommunity(community: CommunityOption) {
    setDestination({
      kind: "community",
      name: community.name,
      title: community.title,
    });
    setPickerOpen(false);
    setCommunityQuery("");
  }

  function resetTurnstile() {
    setTurnstileToken(null);
    turnstileReset.current?.reset();
  }

  function clearImage() {
    mediaKeyRef.current = null;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onImageChange(file: File | null) {
    setError(null);
    if (!file) {
      clearImage();
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError(t("post.imageOnly"));
      clearImage();
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function switchType(next: PostType) {
    setPostType(next);
    setError(null);
    if (next !== "image") clearImage();
    if (next !== "link") setUrl("");
    if (next !== "text") setBody("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    bot.markTrusted(e);

    if (!destination) {
      setError(t("post.chooseDestinationError"));
      setPickerOpen(true);
      return;
    }
    if (postType === "link" && !url.trim()) {
      setError(t("post.linkRequired"));
      return;
    }
    if (postType === "image" && !imageFile) {
      setError(t("post.imageRequired"));
      return;
    }

    const destinationSnapshot = destination;
    const postTypeSnapshot = postType;
    const titleSnapshot = title;
    const bodySnapshot = body;
    const urlSnapshot = url;
    const imageFileSnapshot = imageFile;
    const draftFingerprint = currentDraftRef.current.value;
    const mediaKeySnapshot =
      postTypeSnapshot === "image" ? mediaKeyRef.current : null;

    startTransition(async () => {
      const requestId = requestIdRef.current ?? crypto.randomUUID();
      requestIdRef.current = requestId;
      const isCurrentDraft = () => {
        const current = currentDraftRef.current;
        return (
          current.value === draftFingerprint &&
          current.imageFile === imageFileSnapshot
        );
      };

      try {
        const check = await passBotCheck(bot, turnstileToken);
        if (!check.ok) {
          resetTurnstile();
          if (isCurrentDraft()) {
            setError(localizeError(check.error, t("common.error")));
          }
          return;
        }
        // Siteverify tokens are single-use. Any later retry needs a new token.
        resetTurnstile();

        let mediaKey = mediaKeySnapshot ?? undefined;

        if (postTypeSnapshot === "image" && imageFileSnapshot && !mediaKey) {
          let prepared: File;
          try {
            prepared = await prepareImageForUpload(imageFileSnapshot);
          } catch (prepareError) {
            if (isCurrentDraft()) {
              setError(
                prepareError instanceof Error
                  ? localizeError(
                      prepareError.message,
                      t("post.imageProcessError")
                    )
                  : t("post.imageProcessError")
              );
            }
            return;
          }

          const form = new FormData();
          form.set("file", prepared);
          const upload = await apiFetch("/api/media", {
            method: "POST",
            body: form,
          });
          if (upload.status === 401) {
            if (isCurrentDraft()) {
              router.push(`/login?next=${encodeURIComponent("/submit")}`);
            }
            return;
          }
          if (!upload.ok) {
            const payload = (await upload.json().catch(() => null)) as {
              error?: string;
            } | null;
            if (isCurrentDraft()) {
              setError(
                localizeError(payload?.error, t("post.imageUploadFailed"))
              );
            }
            return;
          }
          const uploaded = (await upload.json()) as { mediaKey?: string };
          if (!uploaded.mediaKey) {
            throw new Error("Image upload failed");
          }
          mediaKey = uploaded.mediaKey;
          if (isCurrentDraft()) {
            mediaKeyRef.current = mediaKey;
          }
        }

        const res = await apiFetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            bot.attachToPayload({
              subreddit: destinationSnapshot.name,
              title: titleSnapshot,
              body:
                postTypeSnapshot === "text"
                  ? bodySnapshot || undefined
                  : undefined,
              url:
                postTypeSnapshot === "link"
                  ? urlSnapshot || undefined
                  : undefined,
              mediaKey,
              requestId,
            })
          ),
        });
        if (res.status === 401) {
          if (isCurrentDraft()) {
            router.push(`/login?next=${encodeURIComponent("/submit")}`);
          }
          return;
        }
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (isCurrentDraft()) {
            setError(localizeError(payload?.error, t("common.error")));
          }
          return;
        }
        const data = (await res.json()) as { id: string };
        if (!isCurrentDraft() || requestIdRef.current !== requestId) {
          return;
        }
        requestIdRef.current = null;
        mediaKeyRef.current = null;
        router.push(`/post/${data.id}`);
        router.refresh();
      } catch (submitError) {
        resetTurnstile();
        if (isCurrentDraft()) {
          setError(
            localizeError(
              submitError instanceof Error ? submitError.message : null,
              t("post.networkError")
            )
          );
        }
      } finally {
        if (isCurrentDraft() && requestIdRef.current === requestId) {
          resetTurnstile();
        }
      }
    });
  }

  return (
    <form onSubmit={submit} className="relative space-y-5" data-hydrated={hydrated}>
      <ParserTraps setTrapRef={bot.setTrapRef} />
      {/* Destination */}
      <div className="space-y-1.5" ref={pickerRef}>
        <label id={`${listId}-label`} className="text-sm font-medium">
          {t("post.community")}
        </label>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          aria-labelledby={`${listId}-label`}
          onClick={() => {
            setPickerOpen((open) => !open);
            if (!pickerOpen) void loadCommunities(communityQuery);
          }}
          className={cn(
            "flex h-11 w-full items-center gap-3 border border-input bg-background px-3 text-left transition-colors",
            fieldRadius,
            "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
          )}
        >
          {destination?.kind === "community" ? (
            <>
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-md bg-[color-mix(in_oklch,var(--brand)_18%,transparent)] text-xs font-bold text-[var(--brand)]"
              >
                c
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {destination.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {destination.title}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
                <SearchIcon className="size-3.5" />
              </span>
              <span className="flex-1 text-sm text-muted-foreground">
                {t("post.community")}
              </span>
            </>
          )}
          <ChevronsUpDownIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>

        {pickerOpen ? (
          <div
            className={cn(
              "z-20 overflow-hidden border border-border/70 bg-popover shadow-lg",
              fieldRadius
            )}
          >
            <div className="border-b border-border/50 p-2">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={communityQuery}
                  onChange={(e) => setCommunityQuery(e.target.value)}
                  placeholder={t("search.communities")}
                  autoFocus
                  autoComplete="off"
                  className={cn("h-9 pl-8", fieldRadius)}
                />
              </div>
            </div>

            <ul
              id={listId}
              role="listbox"
              className="max-h-64 overflow-auto p-1"
            >

              <li className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t("communities.title")}
              </li>

              {loadingCommunities && communities.length === 0 ? (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">
                  {t("search.searching")}
                </li>
              ) : null}
              {!loadingCommunities && communities.length === 0 ? (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">
                  {t("pages.noCommunitiesMatched")}
                </li>
              ) : null}
              {communities.map((community) => {
                const selected =
                  destination?.kind === "community" &&
                  destination.name === community.name;
                return (
                  <li
                    key={community.name}
                    role="option"
                    aria-selected={selected}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
                        selected && "bg-muted"
                      )}
                      onClick={() => selectCommunity(community)}
                    >
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground"
                      >
                        C
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {community.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {community.title} ·{" "}
                          {community.subscriberCount.toLocaleString()}{" "}
                          {t("communities.members")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Type tabs */}
      <div
        className={cn(
          "grid grid-cols-3 gap-1 border border-border/60 bg-muted/40 p-1",
          fieldRadius
        )}
        role="tablist"
        aria-label={t("post.submitTitle")}
      >
        {POST_TYPES.map((type) => {
          const Icon = type.icon;
          const active = postType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchType(type.id)}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`post.${type.id}` as MessageKey)}
            </button>
          );
        })}
      </div>

      {/* Title — modest radius, not a pill */}
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          {t("post.title")}
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={MAX_POST_TITLE_LENGTH}
          placeholder={t("post.titlePlaceholder")}
          className={cn(
            "h-11 font-heading text-base font-medium sm:text-[1.05rem]",
            fieldRadius
          )}
        />
        <p className="text-right text-xs text-muted-foreground">
          {title.length}/{MAX_POST_TITLE_LENGTH}
        </p>
      </div>

      {postType === "text" ? (
        <div className="space-y-1.5">
          <label htmlFor="body" className="text-sm font-medium">
            {t("post.body")}{" "}
            <span className="font-normal text-muted-foreground">
              ({t("post.optional")})
            </span>
          </label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={MAX_POST_BODY_LENGTH}
            placeholder={t("post.bodyPlaceholder")}
            className={cn("min-h-40", fieldRadius)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {body.length}/{MAX_POST_BODY_LENGTH}
          </p>
        </div>
      ) : null}

      {postType === "link" ? (
        <div className="space-y-1.5">
          <label htmlFor="url" className="text-sm font-medium">
            {t("post.url")}
          </label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            required
            maxLength={MAX_POST_URL_LENGTH}
            className={cn("h-11", fieldRadius)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {url.length}/{MAX_POST_URL_LENGTH}
          </p>
        </div>
      ) : null}

      {postType === "image" ? (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("post.image")}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
          />
          {imagePreview ? (
            <div
              className={cn(
                "relative overflow-hidden border border-border/60 bg-muted/30",
                fieldRadius
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt={t("post.selectImage")}
                className="max-h-80 w-full object-contain"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={clearImage}
                aria-label={t("post.removeImage")}
              >
                <XIcon />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onImageChange(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "flex min-h-44 w-full flex-col items-center justify-center gap-2 border border-dashed px-4 py-8 text-center transition-colors",
                fieldRadius,
                dragOver
                  ? "border-[var(--brand)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]"
                  : "border-border/80 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">
                {t("post.dropImage")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("post.imageRequirements")}
              </span>
            </button>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <TurnstileWidget
        onToken={setTurnstileToken}
        resetRef={turnstileReset}
      />

      <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={!hydrated || pending}
          onClick={() => router.back()}
        >
          {t("post.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={
            !hydrated || pending || requiresTurnstileToken(turnstileToken)
          }
          className="min-w-28"
        >
          {pending ? (
            <>
              <Loader2Icon className="animate-spin" />
              {t("post.posting")}
            </>
          ) : (
            t("post.submit")
          )}
        </Button>
      </div>
    </form>
  );
}
