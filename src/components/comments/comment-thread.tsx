"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { shouldOfferTranslation } from "@/components/content/translate-toggle";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { AccountTags } from "@/components/user/account-tags";
import { VoteControls } from "@/components/votes/vote-controls";
import type { CommentNode } from "@/lib/content";
import type {
  CommentVoteResult,
  VoteAction,
  ViewerVote,
} from "@/lib/types";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

function CommentItem({
  comment,
  postId,
  viewerId,
  depth = 0,
}: {
  comment: CommentNode;
  postId: string;
  viewerId?: string | null;
  depth?: number;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const localizeError = useLocalizedError();
  const [score, setScore] = useState(comment.score);
  const [viewerVote, setViewerVote] = useState<ViewerVote>(comment.viewerVote);
  const [body, setBody] = useState(comment.body);
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();
  const isOwner = Boolean(comment.author.isAuthor);
  const offerTranslation =
    !comment.isDeleted &&
    shouldOfferTranslation(comment.translation, locale);
  const displayBody =
    offerTranslation &&
    showTranslation &&
    comment.translation?.bodyTranslated
      ? comment.translation.bodyTranslated
      : body;

  function vote(action: VoteAction) {
    if (viewerVote === action || pending) {
      return;
    }

    setError(null);
    const previous = viewerVote;
    const snapshotScore = score;
    setViewerVote(action);

    if (previous === null) {
      setScore((v) => v + (action === "upvote" ? 1 : -1));
    } else {
      setScore((v) => v + (action === "upvote" ? 2 : -2));
    }

    startTransition(async () => {
      const res = await apiFetch(`/api/comments/${comment.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 401) {
        setViewerVote(previous);
        setScore(snapshotScore);
        router.push(`/login?next=${encodeURIComponent(`/post/${postId}`)}`);
        return;
      }
      if (!res.ok) {
        setViewerVote(previous);
        setScore(snapshotScore);
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Vote failed"));
        return;
      }
      const data = (await res.json()) as CommentVoteResult;
      setScore(data.score);
      setViewerVote(data.viewerVote);
    });
  }

  function submitReply() {
    if (!reply.trim()) return;
    setError(null);
    bot.markTrusted();
    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }
      const res = await apiFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bot.attachToPayload({ body: reply, parentId: comment.id })
        ),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/post/${postId}`)}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Reply failed"));
        return;
      }
      setReply("");
      setReplyOpen(false);
      setTurnstileToken(null);
      turnstileReset.current?.reset();
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "space-y-2",
        depth > 0 && "border-l border-border/60 pl-3 sm:pl-4"
      )}
    >
      <div className="space-y-2 rounded-xl bg-card/40 px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {comment.author.username ? (
            <Link
              href={`/u/${encodeURIComponent(comment.author.username)}`}
              prefetch={false}
              aria-label={`@${comment.author.username}`}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <UserAvatar
                username={comment.author.username}
                image={comment.author.image}
                size="xs"
                className="ring-0"
              />
            </Link>
          ) : (
            <UserAvatar
              username={comment.author.username}
              image={comment.author.image}
              size="xs"
              className="ring-0"
            />
          )}
          {comment.author.username ? (
            <Link
              href={`/u/${comment.author.username}`}
              prefetch={false}
              className="font-medium text-foreground hover:underline"
            >
              @{comment.author.username}
            </Link>
          ) : (
            <span>{t("comments.deleted")}</span>
          )}
          <AccountTags tags={comment.author.tags} />
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {displayBody}
        </p>
        {offerTranslation ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--brand)] hover:underline"
            aria-pressed={showTranslation}
            onClick={() => setShowTranslation((v) => !v)}
          >
            {showTranslation
              ? t("translate.showOriginal")
              : t("translate.action")}
          </button>
        ) : null}
        {!comment.isDeleted ? (
          <div className="flex flex-wrap items-center gap-1">
            <VoteControls
              score={score}
              viewerVote={viewerVote}
              pending={pending}
              layout="horizontal"
              onVote={vote}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-9 px-2 text-xs"
              disabled={pending}
              onClick={() => setReplyOpen((v) => !v)}
            >
              {t("comments.reply")}
            </Button>
            {isOwner ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  disabled={pending}
                  onClick={() => {
                    setEditing((v) => !v);
                    setEditBody(body);
                  }}
                >
                  {editing ? t("common.cancel") : t("common.edit")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(t("comments.deleteConfirm"))) return;
                    startTransition(async () => {
                      const res = await apiFetch(`/api/comments/${comment.id}`, {
                        method: "DELETE",
                      });
                      if (!res.ok) {
                        setError(localizeError("Delete failed"));
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  {t("common.delete")}
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-xs tabular-nums text-muted-foreground">
            {score} pts
          </p>
        )}
        {editing ? (
          <div className="space-y-2 pt-1">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !editBody.trim()}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await apiFetch(`/api/comments/${comment.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body: editBody }),
                  });
                  if (!res.ok) {
                    const payload = (await res.json().catch(() => null)) as {
                      error?: string;
                    } | null;
                    setError(localizeError(payload?.error, "Edit failed"));
                    return;
                  }
                  const data = (await res.json()) as { body: string };
                  setBody(data.body);
                  setEditing(false);
                });
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {replyOpen ? (
          <div className="relative space-y-2 pt-1">
            <ParserTraps setTrapRef={bot.setTrapRef} />
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("comments.replyPlaceholder")}
              rows={3}
            />
            <TurnstileWidget
              onToken={setTurnstileToken}
              resetRef={turnstileReset}
            />
            <Button
              type="button"
              size="sm"
              disabled={
                pending ||
                !reply.trim() ||
                requiresTurnstileToken(turnstileToken)
              }
              onClick={submitReply}
            >
              {t("comments.postReply")}
            </Button>
          </div>
        ) : null}
      </div>
      {comment.children.length > 0 ? (
        <ul className="space-y-3">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              postId={postId}
              viewerId={viewerId}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({
  comments,
  postId,
  viewerId,
}: {
  comments: CommentNode[];
  postId: string;
  viewerId?: string | null;
}) {
  const { t } = useI18n();
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("comments.noComments")}</p>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          viewerId={viewerId}
        />
      ))}
    </ul>
  );
}
