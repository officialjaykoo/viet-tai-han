"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-client";

type Room = {
  id: string;
  lastMessageAt: string | null;
  createdAt: string;
  peer: {
    username: string | null;
    image: string | null;
    displayName: string;
  };
  lastBody: string | null;
};

type RequestItem = {
  id: string;
  roomId: string;
  openerBody: string;
  createdAt: string;
  from: {
    username: string | null;
    image: string | null;
    displayName: string;
  };
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  senderUsername: string | null;
};

export function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const selectedRoom = searchParams.get("room");
  const toParam = searchParams.get("to") ?? "";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composeUser, setComposeUser] = useState(toParam);
  const [composeBody, setComposeBody] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (toParam) setComposeUser(toParam);
  }, [toParam]);

  function loadInbox() {
    startTransition(async () => {
      const res = await apiFetch("/api/messages");
      if (res.status === 401) {
        router.push("/login?next=/messages");
        return;
      }
      if (!res.ok) {
        setError(localizeError("Couldn't load messages"));
        return;
      }
      const data = (await res.json()) as {
        rooms: Room[];
        requests: RequestItem[];
      };
      setRooms(data.rooms);
      setRequests(data.requests);
      setLoaded(true);
    });
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }
    startTransition(async () => {
      const res = await apiFetch(`/api/messages/${selectedRoom}`);
      if (!res.ok) {
        setError(localizeError("Couldn't load chat"));
        return;
      }
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    });
  }, [selectedRoom, localizeError]);

  function startRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUsername: composeUser,
          body: composeBody,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Couldn't send request"));
        return;
      }
      setComposeUser("");
      setComposeBody("");
      setError(null);
      loadInbox();
    });
  }

  function respond(requestId: string, action: "accept" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/messages/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Couldn't update request"));
        return;
      }
      const data = (await res.json()) as { roomId: string; status: string };
      loadInbox();
      if (action === "accept") {
        router.push(`/messages?room=${data.roomId}`);
      }
    });
  }

  function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom || !reply.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/messages/${selectedRoom}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Couldn't send"));
        return;
      }
      const message = (await res.json()) as ChatMessage;
      setMessages((prev) => [...prev, message]);
      setReply("");
      loadInbox();
    });
  }

  const activeRoom = rooms.find((room) => room.id === selectedRoom);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-heading text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            {t("messages.newChat")}
          </h2>
          <form onSubmit={startRequest} className="space-y-2">
            <Input
              value={composeUser}
              onChange={(e) => setComposeUser(e.target.value)}
              placeholder={t("messages.username")}
              required
              className="rounded-lg"
            />
            <Textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder={t("messages.openerPlaceholder")}
              rows={3}
              required
              className="rounded-lg"
            />
            <Button type="submit" size="sm" disabled={pending} className="w-full">
              {t("messages.requestChat")}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            {t("messages.requestHint")}
          </p>
        </section>

        {requests.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-heading text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              {t("messages.requests")}
            </h2>
            <ul className="space-y-2">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="rounded-xl border border-border/60 bg-card/70 p-3"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      username={req.from.username}
                      image={req.from.image}
                      size="xs"
                    />
                    <span className="text-sm font-medium">
                      @{req.from.username}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {req.openerBody}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="xs"
                      disabled={pending}
                      onClick={() => respond(req.id, "accept")}
                    >
                      {t("messages.accept")}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => respond(req.id, "decline")}
                    >
                      {t("messages.decline")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-2">
          <h2 className="font-heading text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            {t("messages.chats")}
          </h2>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("messages.noOpenChats")}
            </p>
          ) : (
            <ul className="space-y-1">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/messages?room=${room.id}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted",
                      selectedRoom === room.id && "bg-muted"
                    )}
                  >
                    <UserAvatar
                      username={room.peer.username}
                      image={room.peer.image}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        @{room.peer.username}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {room.lastBody ?? t("messages.noMessagesYet")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <section className="flex min-h-[28rem] flex-col rounded-2xl border border-border/60 bg-card/70">
        {activeRoom ? (
          <>
            <header className="border-b border-border/50 px-4 py-3">
              <p className="font-medium">@{activeRoom.peer.username}</p>
            </header>
            <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    message.isMine
                      ? "ml-auto bg-[color-mix(in_oklch,var(--brand)_18%,transparent)]"
                      : "bg-muted"
                  )}
                >
                  {message.body}
                </div>
              ))}
            </div>
            <form
              onSubmit={sendReply}
              className="flex gap-2 border-t border-border/50 p-3"
            >
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t("messages.placeholder")}
                className="rounded-lg"
              />
              <Button type="submit" disabled={pending || !reply.trim()}>
                {t("messages.send")}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t("messages.selectChat")}
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-destructive lg:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
