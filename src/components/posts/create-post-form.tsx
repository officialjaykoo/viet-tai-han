"use client";

import {
  ChevronsUpDownIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  SearchIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { useSession } from "@/lib/auth-client";
import { prepareImageForUpload } from "@/lib/prepare-image";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type PostType = "text" | "image" | "link";

type CommunityOption = {
  name: string;
  title: string;
  subscriberCount: number;
};

type Destination =
  | { kind: "profile" }
  | { kind: "community"; name: string; title: string };

const POST_TYPES: {
  id: PostType;
  label: string;
  icon: typeof FileTextIcon;
}[] = [
  { id: "text", label: "Text", icon: FileTextIcon },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "link", label: "Link", icon: Link2Icon },
];

const fieldRadius = "rounded-lg";

export function CreatePostForm({
  defaultSubreddit = "",
}: {
  defaultSubreddit?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const username =
    (session?.user as { username?: string } | undefined)?.username ??
    session?.user?.name ??
    null;
  const image = session?.user?.image ?? null;

  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const [postType, setPostType] = useState<PostType>("text");
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

  // Default destination: own profile once session is known (unless community was prefills)
  useEffect(() => {
    if (defaultSubreddit) return;
    if (destination) return;
    if (username) {
      setDestination({ kind: "profile" });
    }
  }, [defaultSubreddit, destination, username]);

  const loadCommunities = useEffectEvent(async (query: string) => {
    setLoadingCommunities(true);
    try {
      const res = await apiFetch(
        `/api/search?type=communities&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { communities?: CommunityOption[] };
      // Hide personal u_* communities from the community list
      setCommunities(
        (data.communities ?? []).filter(
          (c) => !/^u_/i.test(c.name)
        )
      );
    } catch {
      // Keep previous suggestions
    } finally {
      setLoadingCommunities(false);
    }
  });

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = window.setTimeout(() => {
      void loadCommunities(communityQuery);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [communityQuery, pickerOpen]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectProfile() {
    setDestination({ kind: "profile" });
    setPickerOpen(false);
    setCommunityQuery("");
  }

  function selectCommunity(community: CommunityOption) {
    setDestination({
      kind: "community",
      name: community.name,
      title: community.title,
    });
    setPickerOpen(false);
    setCommunityQuery("");
  }

  function clearImage() {
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
      setError("Only image files are allowed");
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
      setError("Choose where to post");
      setPickerOpen(true);
      return;
    }
    if (postType === "link" && !url.trim()) {
      setError("Add a link URL");
      return;
    }
    if (postType === "image" && !imageFile) {
      setError("Add an image");
      return;
    }

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(check.error);
        return;
      }

      let mediaKey: string | undefined;

      if (postType === "image" && imageFile) {
        let prepared: File;
        try {
          prepared = await prepareImageForUpload(imageFile);
        } catch (prepareError) {
          setError(
            prepareError instanceof Error
              ? prepareError.message
              : "Could not process image"
          );
          return;
        }

        const form = new FormData();
        form.set("file", prepared);
        const upload = await apiFetch("/api/media", {
          method: "POST",
          body: form,
        });
        if (upload.status === 401) {
          router.push(`/login?next=${encodeURIComponent("/submit")}`);
          return;
        }
        if (!upload.ok) {
          const payload = (await upload.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(payload?.error ?? "Image upload failed");
          return;
        }
        const uploaded = (await upload.json()) as { mediaKey: string };
        mediaKey = uploaded.mediaKey;
      }

      const res = await apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bot.attachToPayload({
            subreddit:
              destination.kind === "profile" ? "profile" : destination.name,
            title,
            body: postType === "text" ? body || undefined : undefined,
            url: postType === "link" ? url || undefined : undefined,
            mediaKey,
          })
        ),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/submit")}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Failed to create post");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/post/${data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="relative space-y-5">
      <ParserTraps setTrapRef={bot.setTrapRef} />
      {/* Destination */}
      <div className="space-y-1.5" ref={pickerRef}>
        <label id={`${listId}-label`} className="text-sm font-medium">
          Post to
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
          {destination?.kind === "profile" && username ? (
            <>
              <UserAvatar
                username={username}
                image={image}
                size="xs"
                className="ring-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  My profile
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  u/{username}
                </span>
              </span>
            </>
          ) : destination?.kind === "community" ? (
            <>
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-md bg-[color-mix(in_oklch,var(--brand)_18%,transparent)] text-xs font-bold text-[var(--brand)]"
              >
                r/
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  r/{destination.name}
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
                Choose a community or your profile
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
                  placeholder="Search communities"
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
              {username ? (
                <li role="option" aria-selected={destination?.kind === "profile"}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
                      destination?.kind === "profile" && "bg-muted"
                    )}
                    onClick={selectProfile}
                  >
                    <UserAvatar
                      username={username}
                      image={image}
                      size="sm"
                      className="ring-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <UserRoundIcon className="size-3.5 text-[var(--brand)]" />
                        My profile
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Post on your account · u/{username}
                      </span>
                    </span>
                  </button>
                </li>
              ) : null}

              <li className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Communities
              </li>

              {loadingCommunities && communities.length === 0 ? (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">
                  Searching…
                </li>
              ) : null}
              {!loadingCommunities && communities.length === 0 ? (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">
                  No communities found
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
                        r/
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          r/{community.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {community.title} ·{" "}
                          {community.subscriberCount.toLocaleString()} members
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
        aria-label="Post type"
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
              {type.label}
            </button>
          );
        })}
      </div>

      {/* Title — modest radius, not a pill */}
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={300}
          placeholder="An interesting title"
          className={cn(
            "h-11 font-heading text-base font-medium sm:text-[1.05rem]",
            fieldRadius
          )}
        />
        <p className="text-right text-xs text-muted-foreground">
          {title.length}/300
        </p>
      </div>

      {postType === "text" ? (
        <div className="space-y-1.5">
          <label htmlFor="body" className="text-sm font-medium">
            Body{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Share more context…"
            className={cn("min-h-40", fieldRadius)}
          />
        </div>
      ) : null}

      {postType === "link" ? (
        <div className="space-y-1.5">
          <label htmlFor="url" className="text-sm font-medium">
            Link
          </label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            required
            className={cn("h-11", fieldRadius)}
          />
        </div>
      ) : null}

      {postType === "image" ? (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Image</span>
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
                alt="Selected upload preview"
                className="max-h-80 w-full object-contain"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={clearImage}
                aria-label="Remove image"
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
                Drop an image here, or click to browse
              </span>
              <span className="text-xs text-muted-foreground">
                JPEG, PNG, or WebP · max 1 MB after compression
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
          disabled={pending}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending || requiresTurnstileToken(turnstileToken)}
          className="min-w-28"
        >
          {pending ? (
            <>
              <Loader2Icon className="animate-spin" />
              Posting…
            </>
          ) : (
            "Post"
          )}
        </Button>
      </div>
    </form>
  );
}
