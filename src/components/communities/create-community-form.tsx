"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { apiFetch } from "@/lib/api-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

export function CreateCommunityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileReset = useRef<{ reset: () => void } | null>(null);
  const bot = useBotGuard();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    bot.markTrusted(e);
    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(check.error);
        return;
      }

      const res = await apiFetch("/api/subreddits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, description }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/communities")}`);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Failed to create community");
        return;
      }
      const data = (await res.json()) as { name: string };
      turnstileReset.current?.reset();
      router.push(`/r/${data.name}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="relative space-y-3">
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="name (e.g. cloudflare)"
        required
        minLength={3}
        maxLength={32}
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Display title"
        required
        minLength={3}
        maxLength={100}
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="About this community"
        rows={3}
      />
      <TurnstileWidget
        onToken={setTurnstileToken}
        resetRef={turnstileReset}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || requiresTurnstileToken(turnstileToken)}
      >
        Create community
      </Button>
    </form>
  );
}
