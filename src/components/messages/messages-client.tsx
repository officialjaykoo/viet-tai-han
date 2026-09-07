"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { announceUnreadChanged } from "@/components/notifications/use-unread-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { apiFetch } from "@/lib/api-client";
import {
  applyIncomingRoomMessage,
  reconcileChatRoomRead,
  reconcileRoomLatestMessage,
} from "@/lib/chat-room-state";
import {
  mergeMessages,
  updateLocalDeliveryState,
  type LocalChatMessage,
} from "@/lib/chat-message-state";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  lastMessageAt: string | null;
  lastMessageId: string | null;
  createdAt: string;
  peer: {
    username: string | null;
    image: string | null;
    displayName: string;
  };
  lastBody: string | null;
  unreadCount: number;
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

type ChatMessage = LocalChatMessage;

type ChatHistoryPage = {
  messages: ChatMessage[];
  hasMoreBefore: boolean;
  nextBeforeCursor: string | null;
  hasMoreAfter: boolean;
  nextAfterCursor: string | null;
};

type RealtimeMessageEvent =
  | {
      type: "ready";
      roomId: string;
    }
  | {
      type: "message";
      roomId: string;
      message: ChatMessage;
    };

function parseRealtimeMessage(value: unknown): RealtimeMessageEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as {
    type?: unknown;
    roomId?: unknown;
    message?: unknown;
  };
  if (typeof event.roomId !== "string") return null;
  if (event.type === "ready") {
    return { type: "ready", roomId: event.roomId };
  }
  if (
    event.type !== "message" ||
    !event.message ||
    typeof event.message !== "object"
  ) {
    return null;
  }

  const message = event.message as Partial<ChatMessage>;
  if (
    typeof message.id !== "string" ||
    typeof message.body !== "string" ||
    typeof message.createdAt !== "string" ||
    typeof message.isMine !== "boolean" ||
    (message.clientMessageId !== undefined &&
      message.clientMessageId !== null &&
      typeof message.clientMessageId !== "string") ||
    (typeof message.senderUsername !== "string" &&
      message.senderUsername !== null)
  ) {
    return null;
  }

  return {
    type: "message",
    roomId: event.roomId,
    message: {
      id: message.id,
      clientMessageId: message.clientMessageId ?? null,
      body: message.body,
      createdAt: message.createdAt,
      isMine: message.isMine,
      senderUsername: message.senderUsername,
    },
  };
}

type ChatReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "misinformation"
  | "nsfw"
  | "other";

const CHAT_REPORT_REASONS: ChatReportReason[] = [
  "spam",
  "harassment",
  "hate",
  "misinformation",
  "nsfw",
  "other",
];

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
  const [composeOpen, setComposeOpen] = useState(Boolean(toParam));
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<ChatReportReason>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);
  const latestRoomMessagesRef = useRef(new Map<string, ChatMessage>());
  const composeClientMessageIdRef = useRef<string | null>(null);
  const beforeCursorRef = useRef<string | null>(null);
  const afterCursorRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const preservingPrependRef = useRef(false);
  const catchUpInFlightRef = useRef(false);
  const socketReadyRoomRef = useRef<string | null>(null);
  const activeRoomRef = useRef<string | null>(selectedRoom);
  const readTimerRef = useRef<number | null>(null);
  const sendingClientMessageIdsRef = useRef(new Set<string>());
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    // URL query changes intentionally seed the compose field.
    if (toParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComposeUser(toParam);
      setComposeOpen(true);
    }
  }, [toParam]);

  const rememberRoomLatestMessage = useCallback(
    (roomId: string, message: ChatMessage) => {
      const current = latestRoomMessagesRef.current.get(roomId);
      const isLater =
        !current ||
        message.createdAt > current.createdAt ||
        (message.createdAt === current.createdAt && message.id >= current.id);
      if (isLater || current?.id === message.id) {
        latestRoomMessagesRef.current.set(roomId, message);
      }
    },
    []
  );

  const reconcileRoomLatest = useCallback(
    (roomId: string, message: ChatMessage) => {
      rememberRoomLatestMessage(roomId, message);
      const nextRooms = reconcileRoomLatestMessage(
        roomsRef.current,
        roomId,
        message
      );
      if (nextRooms === roomsRef.current) return;
      roomsRef.current = nextRooms;
      setRooms(nextRooms);
    },
    [rememberRoomLatestMessage]
  );

  const loadInbox = useCallback(() => {
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
      let nextRooms = data.rooms;
      for (const [roomId, message] of latestRoomMessagesRef.current) {
        nextRooms = reconcileRoomLatestMessage(nextRooms, roomId, message);
      }
      roomsRef.current = nextRooms;
      setRooms(nextRooms);
      setRequests(data.requests);
      setLoaded(true);
    });
  }, [localizeError, router]);

  const applyRoomMessage = useCallback(
    (roomId: string, message: ChatMessage) => {
      rememberRoomLatestMessage(roomId, message);
      const result = applyIncomingRoomMessage(
        roomsRef.current,
        roomId,
        message,
        isNearBottomRef.current
      );
      if (result.rooms === roomsRef.current && result.unreadDelta === 0) {
        return;
      }
      roomsRef.current = result.rooms;
      setRooms(result.rooms);
      if (result.unreadDelta > 0) {
        announceUnreadChanged({ messageDelta: result.unreadDelta });
      }
    },
    [rememberRoomLatestMessage]
  );

  const catchUpRoom = useCallback(
    async (roomId: string) => {
      if (
        activeRoomRef.current !== roomId ||
        !afterCursorRef.current ||
        catchUpInFlightRef.current
      ) {
        return;
      }
      catchUpInFlightRef.current = true;
      try {
        let cursor = afterCursorRef.current;
        while (cursor && activeRoomRef.current === roomId) {
          const res = await apiFetch(
            `/api/messages/${roomId}?after=${encodeURIComponent(cursor)}`
          );
          if (!res.ok) return;
          const page = (await res.json()) as ChatHistoryPage;
          if (page.messages.length === 0) return;
          setMessages((current) => mergeMessages(current, page.messages));
          for (const message of page.messages) {
            applyRoomMessage(roomId, message);
          }
          if (!page.nextAfterCursor) return;
          cursor = page.nextAfterCursor;
          afterCursorRef.current = cursor;
          if (!page.hasMoreAfter) break;
        }
      } catch {
        // D1 catch-up is retried by the next reconnect/ready cycle.
      } finally {
        catchUpInFlightRef.current = false;
      }
    },
    [applyRoomMessage]
  );
  const loadOlderMessages = useCallback(async () => {
    const roomId = activeRoomRef.current;
    const cursor = beforeCursorRef.current;
    const element = messageListRef.current;
    if (!roomId || !cursor || !element || loadingOlderRef.current) return;

    loadingOlderRef.current = true;
    const previousHeight = element.scrollHeight;
    const previousTop = element.scrollTop;
    try {
      const res = await apiFetch(
        `/api/messages/${roomId}?before=${encodeURIComponent(cursor)}`
      );
      if (!res.ok) {
        setError(localizeError("Couldn't load chat"));
        return;
      }
      const page = (await res.json()) as ChatHistoryPage;
      if (activeRoomRef.current !== roomId) return;
      beforeCursorRef.current = page.nextBeforeCursor;
      setHasMoreBefore(page.hasMoreBefore);
      preservingPrependRef.current = true;
      setMessages((current) => mergeMessages(page.messages, current));
      window.requestAnimationFrame(() => {
        const currentElement = messageListRef.current;
        if (!currentElement || activeRoomRef.current !== roomId) return;
        currentElement.scrollTop =
          previousTop + currentElement.scrollHeight - previousHeight;
      });
    } catch {
      if (activeRoomRef.current === roomId) {
        setError(localizeError("Couldn't load chat"));
      }
    } finally {
      loadingOlderRef.current = false;
    }
  }, [localizeError]);

  const loadRoom = useCallback(
    async (roomId: string) => {
      try {
        const res = await apiFetch(`/api/messages/${roomId}`);
        if (!res.ok) {
          setError(localizeError("Couldn't load chat"));
          return;
        }
        const page = (await res.json()) as ChatHistoryPage;
        if (activeRoomRef.current !== roomId) return;
        beforeCursorRef.current = page.nextBeforeCursor;
        afterCursorRef.current = page.nextAfterCursor;
        setHasMoreBefore(page.hasMoreBefore);
        setMessages((current) => mergeMessages(current, page.messages));
        const latestMessage = page.messages[page.messages.length - 1];
        if (latestMessage) {
          reconcileRoomLatest(roomId, latestMessage);
        }
        if (socketReadyRoomRef.current === roomId) {
          void catchUpRoom(roomId);
        }
      } catch {
        if (activeRoomRef.current === roomId) {
          setError(localizeError("Couldn't load chat"));
        }
      }
    },
    [catchUpRoom, localizeError, reconcileRoomLatest]
  );


  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    activeRoomRef.current = selectedRoom;
    isNearBottomRef.current = true;
    // A room switch must not display the previous room while the new room loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    if (readTimerRef.current !== null) {
      window.clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
    beforeCursorRef.current = null;
    afterCursorRef.current = null;
    socketReadyRoomRef.current = null;
    preservingPrependRef.current = false;
    setHasMoreBefore(false);
    setShowNewMessages(false);
    setIsNearBottom(true);
    shouldStickToBottomRef.current = true;
    if (!selectedRoom) return;

    void loadRoom(selectedRoom);
  }, [selectedRoom, loadRoom]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!selectedRoom || !messageList || messages.length === 0) return;
    if (preservingPrependRef.current) {
      preservingPrependRef.current = false;
      return;
    }
    if (shouldStickToBottomRef.current) {
      messageList.scrollTop = messageList.scrollHeight;
    } else {
      setShowNewMessages(true);
    }
  }, [messages.length, selectedRoom]);

  const markChatRead = useCallback(
    async (roomId: string, messageId: string) => {
      try {
        const res = await apiFetch(`/api/messages/${roomId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        });
        if (!res.ok) return;
        const result = (await res.json()) as {
          messageId?: string | null;
          updated?: boolean;
        };
        // `updated` only describes a server-side boundary mutation. A
        // successful response still authoritatively acknowledges messageId.
        if (result.messageId !== messageId) return;
        const reconciliation = reconcileChatRoomRead(
          roomsRef.current,
          roomId,
          result.messageId
        );
        if (!reconciliation.acknowledged) return;
        roomsRef.current = reconciliation.rooms;
        setRooms(reconciliation.rooms);
        if (reconciliation.clearedUnread > 0) {
          announceUnreadChanged({
            messageDelta: -reconciliation.clearedUnread,
          });
        }
      } catch {
        // The next explicit read or inbox refresh reconciles the boundary.
      }
    },
    []
  );

  const scheduleChatRead = useCallback(
    (roomId: string, messageId: string) => {
      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
      }
      readTimerRef.current = window.setTimeout(() => {
        readTimerRef.current = null;
        void markChatRead(roomId, messageId);
      }, 350);
    },
    [markChatRead]
  );

  useEffect(() => {
    if (
      !selectedRoom ||
      !isNearBottom ||
      document.visibilityState !== "visible" ||
      messages.length === 0
    ) {
      return;
    }
    const lastMessage = messages[messages.length - 1];
    scheduleChatRead(selectedRoom, lastMessage.id);
    return () => {
      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
    };
  }, [isNearBottom, messages, scheduleChatRead, selectedRoom]);

  useEffect(() => {
    if (!selectedRoom || messages.length === 0) return;
    const handleVisibility = () => {
      if (
        document.visibilityState !== "visible" ||
        !isNearBottomRef.current
      ) {
        return;
      }
      const lastMessage = messages[messages.length - 1];
      scheduleChatRead(selectedRoom, lastMessage.id);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [messages, scheduleChatRead, selectedRoom]);


  useEffect(() => {
    if (!selectedRoom) return;

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const endpoint = `${protocol}//${window.location.host}/api/messages/realtime?room=${encodeURIComponent(selectedRoom)}`;

    const canConnect = () =>
      active &&
      document.visibilityState === "visible" &&
      navigator.onLine !== false;

    const scheduleReconnect = () => {
      if (!canConnect() || reconnectTimer !== null) return;
      const baseDelay = Math.min(
        1_000 * 2 ** Math.min(reconnectAttempt, 4),
        10_000
      );
      const jitter = Math.floor(Math.random() * Math.max(250, baseDelay / 4));
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, baseDelay + jitter);
    };

    const connect = () => {
      if (
        !canConnect() ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      try {
        socket = new WebSocket(endpoint);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        // Reset only after the DO sends ready; an open-but-stalled socket must back off.
      };
      socket.onmessage = (event) => {
        if (!active || typeof event.data !== "string") return;
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        const live = parseRealtimeMessage(payload);
        if (!live || live.roomId !== selectedRoom) return;
        if (live.type === "ready") {
          socketReadyRoomRef.current = selectedRoom;
          reconnectAttempt = 0;
          void catchUpRoom(selectedRoom);
          return;
        }

        setMessages((current) => mergeMessages(current, [live.message]));
        applyRoomMessage(live.roomId, live.message);
      };
      socket.onerror = () => {
        socket?.close();
      };
      socket.onclose = () => {
        socket = null;
        if (socketReadyRoomRef.current === selectedRoom) {
          socketReadyRoomRef.current = null;
        }
        scheduleReconnect();
      };
    };

    const reconnectNow = () => {
      if (!canConnect()) return;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempt = 0;
      connect();
    };
    const handleOnline = () => reconnectNow();
    const handleOffline = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close(1000, "offline");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reconnectNow();
      } else {
        handleOffline();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    connect();
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close(1000, "room changed");
    };
  }, [selectedRoom, catchUpRoom, applyRoomMessage]);

  function startConversation(e: React.FormEvent) {
    e.preventDefault();
    const toUsername = composeUser.trim();
    const openerBody = composeBody.trim();
    if (composeSending || !toUsername || !openerBody) return;
    const clientMessageId =
      composeClientMessageIdRef.current ?? crypto.randomUUID();
    composeClientMessageIdRef.current = clientMessageId;
    setComposeSending(true);
    startTransition(async () => {
      try {
        const res = await apiFetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toUsername,
            body: openerBody,
            clientMessageId,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(localizeError(payload?.error, "Couldn't send message"));
          return;
        }
        const result = (await res.json()) as {
          conversationType?: "direct" | "request";
          roomId?: string;
        };
        setComposeUser("");
        setComposeBody("");
        setComposeOpen(false);
        composeClientMessageIdRef.current = null;
        setError(null);
        if (result.conversationType === "direct" && result.roomId) {
          router.push(`/messages?room=${encodeURIComponent(result.roomId)}`);
        }
        loadInbox();
      } finally {
        setComposeSending(false);
      }
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

  const sendReplyRequest = useCallback(
    async (roomId: string, body: string, clientMessageId: string) => {
      try {
        const res = await apiFetch(`/api/messages/${roomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientMessageId }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setMessages((current) =>
            updateLocalDeliveryState(current, clientMessageId, "failed")
          );
          setError(localizeError(payload?.error, t("messages.sendFailed")));
          return;
        }
        const message = (await res.json()) as ChatMessage;
        setMessages((current) =>
          mergeMessages(current, [
            { ...message, localDeliveryState: "sent" },
          ])
        );
        applyRoomMessage(roomId, message);
        setError(null);
      } catch {
        setMessages((current) =>
          updateLocalDeliveryState(current, clientMessageId, "failed")
        );
        setError(t("messages.sendFailed"));
      } finally {
        sendingClientMessageIdsRef.current.delete(clientMessageId);
      }
    },
    [applyRoomMessage, localizeError, t]
  );

  const retryMessage = useCallback(
    (message: ChatMessage) => {
      const roomId = selectedRoom;
      const clientMessageId = message.clientMessageId;
      if (
        !roomId ||
        !clientMessageId ||
        message.localDeliveryState !== "failed" ||
        sendingClientMessageIdsRef.current.has(clientMessageId)
      ) {
        return;
      }
      sendingClientMessageIdsRef.current.add(clientMessageId);
      setMessages((current) =>
        updateLocalDeliveryState(current, clientMessageId, "sending")
      );
      void sendReplyRequest(roomId, message.body, clientMessageId);
    },
    [selectedRoom, sendReplyRequest]
  );

  function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const roomId = selectedRoom;
    const body = reply.trim();
    if (!roomId || !body) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: `local:${clientMessageId}`,
      clientMessageId,
      body,
      createdAt: new Date().toISOString(),
      isMine: true,
      senderUsername: null,
      localDeliveryState: "sending",
    };
    setMessages((current) => mergeMessages(current, [optimistic]));
    setReply("");
    setError(null);
    sendingClientMessageIdsRef.current.add(clientMessageId);
    void sendReplyRequest(roomId, body, clientMessageId);
  }
  function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await apiFetch(`/api/messages/${selectedRoom}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(localizeError(payload?.error, "Couldn't report conversation"));
        return;
      }
      setReportOpen(false);
      setReportDetails("");
      setNotice(t("post.reportSubmitted"));
    });
  }

  const activeRoom = rooms.find((room) => room.id === selectedRoom);
  const reportReasonLabels: Record<ChatReportReason, string> = {
    spam: t("messages.reasonSpam"),
    harassment: t("messages.reasonHarassment"),
    hate: t("messages.reasonHate"),
    misinformation: t("messages.reasonMisinformation"),
    nsfw: t("messages.reasonNsfw"),
    other: t("messages.reasonOther"),
  };

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside
        className={cn(
          "min-w-0 space-y-3",
          selectedRoom ? "hidden lg:block" : "block",
          "lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          <h1 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("messages.inbox")}
          </h1>
          <Button
            type="button"
            size="xs"
            variant={composeOpen ? "secondary" : "ghost"}
            aria-expanded={composeOpen}
            onClick={() => setComposeOpen((open) => !open)}
          >
            {t("messages.newChat")}
          </Button>
        </div>

        {composeOpen ? (
          <section className="rounded-xl border border-border/60 bg-card/70 p-2.5">
            <form onSubmit={startConversation} className="space-y-1.5">
              <Input
                value={composeUser}
                onChange={(e) => setComposeUser(e.target.value)}
                placeholder={t("messages.username")}
                required
                className="h-10 rounded-lg text-sm sm:h-9"
              />
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder={t("messages.openerPlaceholder")}
                rows={2}
                required
                className="min-h-14 rounded-lg px-3 py-2 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={composeSending}
                className="w-full"
              >
                {t("messages.send")}
              </Button>
            </form>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("messages.requestHint")}
            </p>
          </section>
        ) : null}

        {requests.length > 0 ? (
          <section className="space-y-1.5">
            <h2 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("messages.requests")}
            </h2>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="rounded-xl border border-border/60 bg-card/70 p-2.5"
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
                  <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">
                    {req.openerBody}
                  </p>
                  <div className="mt-1.5 flex gap-2">
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

        <section className="space-y-1.5">
          <h2 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("messages.chats")}
          </h2>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("messages.noOpenChats")}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/messages?room=${room.id}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted",
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
                    {room.unreadCount > 0 ? (
                      <span
                        className="grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold leading-5 text-[var(--brand-foreground)] tabular-nums"
                        aria-label={t("messages.unreadCount", {
                          count: room.unreadCount,
                        })}
                      >
                        {room.unreadCount > 99 ? "99+" : room.unreadCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <section
        className={cn(
          "relative min-w-0 flex-col rounded-xl border border-border/60 bg-card/70 h-[calc(100dvh-8rem)] min-h-[28rem]",
          selectedRoom ? "flex" : "hidden lg:flex",
          "lg:h-[calc(100dvh-6rem)] lg:min-h-0 lg:max-h-none"
        )}
      >
        {activeRoom ? (
          <>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="lg:hidden"
                  aria-label={t("messages.chats")}
                  onClick={() => router.push("/messages")}
                >
                  ←
                </Button>
                <p className="truncate font-medium">
                  @{activeRoom.peer.username}
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  setReportOpen(true);
                  setError(null);
                  setNotice(null);
                }}
              >
                {t("messages.report")}
              </Button>
            </header>
            <div
              ref={messageListRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                const nearBottom =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <=
                  96;
                shouldStickToBottomRef.current = nearBottom;
                isNearBottomRef.current = nearBottom;
                setIsNearBottom(nearBottom);
                if (nearBottom) {
                  setShowNewMessages(false);
                } else if (element.scrollTop <= 48 && hasMoreBefore) {
                  void loadOlderMessages();
                }
              }}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
            >
              <div className="flex flex-col">
                {messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const sameSide = previous
                    ? previous.isMine === message.isMine
                    : false;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        index === 0 ? "pt-0" : sameSide ? "pt-0.5" : "pt-2",
                        "space-y-0.5",
                        message.isMine
                          ? "ml-auto max-w-[88%] sm:max-w-[80%] lg:max-w-[75%]"
                          : "max-w-[88%] sm:max-w-[80%] lg:max-w-[75%]"
                      )}
                    >
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
                          message.isMine
                            ? "bg-[color-mix(in_oklch,var(--brand)_18%,transparent)]"
                            : "bg-muted"
                        )}
                      >
                        {message.body}
                      </div>
                      {message.localDeliveryState === "sending" ? (
                        <p className="text-right text-[11px] text-muted-foreground">
                          {t("messages.sending")}
                        </p>
                      ) : null}
                      {message.localDeliveryState === "failed" &&
                      message.clientMessageId ? (
                        <div className="flex items-center justify-end gap-2 text-[11px] text-destructive">
                          <span role="status">{t("messages.sendFailed")}</span>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => retryMessage(message)}
                          >
                            {t("messages.retry")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {showNewMessages ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  className="sticky bottom-2 left-1/2 -translate-x-1/2 shadow-sm"
                  onClick={() => {
                    const element = messageListRef.current;
                    if (!element) return;
                    element.scrollTop = element.scrollHeight;
                    shouldStickToBottomRef.current = true;
                    isNearBottomRef.current = true;
                    setIsNearBottom(true);
                    setShowNewMessages(false);
                  }}
                >
                  {t("messages.newMessages")}
                </Button>
              ) : null}
            </div>
            <form
              onSubmit={sendReply}
              className="flex shrink-0 items-end gap-2 border-t border-border/50 px-3 py-2"
            >
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                placeholder={t("messages.placeholder")}
                rows={1}
                className="max-h-32 min-h-10 flex-1 overflow-y-auto rounded-lg px-3 py-2 text-sm"
              />
              <Button type="submit" size="sm" disabled={!reply.trim()}>
                {t("messages.send")}
              </Button>
            </form>
            {reportOpen ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
                <form
                  onSubmit={submitReport}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="conversation-report-title"
                  className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl"
                >
                  <div>
                    <h2
                      id="conversation-report-title"
                      className="font-heading text-lg font-semibold"
                    >
                      {t("messages.reportConversation")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("messages.reportConversationPrompt")}
                    </p>
                  </div>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                    value={reportReason}
                    onChange={(e) =>
                      setReportReason(e.target.value as ChatReportReason)
                    }
                    aria-label={t("messages.reportReason")}
                  >
                    {CHAT_REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reportReasonLabels[reason]}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder={t("messages.reportDetails")}
                    rows={3}
                    className="rounded-lg text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        setReportOpen(false);
                        setReportDetails("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" variant="destructive" disabled={pending}>
                      {t("messages.submitReport")}
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {t("messages.selectChat")}
          </div>
        )}
      </section>

      {notice ? (
        <p className="text-sm text-emerald-700 lg:col-span-2" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive lg:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
