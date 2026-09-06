"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

const subscribeToHydration = () => () => {};

export function CreateCommunityForm() {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
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
        setError(localizeError(check.error, t("common.error")));
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
        setError(localizeError(payload?.error, t("common.error")));
        return;
      }
      const data = (await res.json()) as { name: string };
      turnstileReset.current?.reset();
      router.push(`/r/${data.name}`);
      router.refresh();
    });
  }

  function closeForm() {
    setOpen(false);
    setName("");
    setTitle("");
    setDescription("");
    setError(null);
    setTurnstileToken(null);
    turnstileReset.current?.reset();
  }

  if (!open) {
    return (
      <Button
        type="button"
        className="min-h-11"
        data-hydrated={hydrated}
        onClick={() => setOpen(true)}
      >
        {t("communities.createCommunity")}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative space-y-4 rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5"
      data-hydrated={hydrated}
    >
      <ParserTraps setTrapRef={bot.setTrapRef} />
      <div className="space-y-2">
        <label htmlFor="community-name" className="text-sm font-medium">
          {t("communities.name")}
        </label>
        <Input
          id="community-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("communities.namePlaceholder")}
          required
          minLength={3}
          maxLength={32}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="community-title" className="text-sm font-medium">
          {t("communities.communityTitle")}
        </label>
        <Input
          id="community-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("communities.titlePlaceholder")}
          required
          minLength={3}
          maxLength={100}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="community-description" className="text-sm font-medium">
          {t("communities.description")}
        </label>
        <Textarea
          id="community-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("communities.descriptionPlaceholder")}
          rows={4}
          disabled={pending}
        />
      </div>
      <TurnstileWidget
        onToken={setTurnstileToken}
        resetRef={turnstileReset}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            !hydrated || pending || requiresTurnstileToken(turnstileToken)
          }
        >
          {t("communities.createCommunity")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={closeForm}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
