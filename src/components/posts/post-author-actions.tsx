"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-client";

export function PostAuthorActions({
  postId,
  isOwner,
  initialTitle,
  initialBody,
}: {
  postId: string;
  isOwner: boolean;
  initialTitle: string;
  initialBody: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) return null;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Edit failed"));
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(t("post.deleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Delete failed"));
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Link
          href={`/post/${postId}/stats`}
          className={cn(
            buttonVariants({ size: "sm", variant: "ghost" }),
            "min-h-8"
          )}
        >
          {t("post.analytics")}
        </Link>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? t("post.cancel") : t("post.edit")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={remove}
        >
          {t("post.delete")}
        </Button>
      </div>
      {editing ? (
        <div className="space-y-2 rounded-2xl border border-border/60 p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
          <Button type="button" size="sm" disabled={pending} onClick={save}>
            {t("post.save")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
