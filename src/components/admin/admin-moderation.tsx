"use client";

import { useState } from "react";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminBannedWord = { id: string; word: string; severity: string };

export function AdminModeration({
  bannedWords,
}: {
  bannedWords: AdminBannedWord[];
}) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState<"shadow" | "block">("shadow");
  const [userId, setUserId] = useState("");
  const [warning, setWarning] = useState("");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t("admin.bannedWords")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage automated moderation and account warnings.
        </p>
      </section>
      <AdminFeedback error={error} message={message} />
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-xl font-semibold">
            {t("admin.bannedWords")}
          </h2>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run("add_banned_word", { word, severity });
              setWord("");
            }}
          >
            <Input
              required
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder={t("admin.wordOrPhrase")}
              aria-label={t("admin.wordOrPhrase")}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as "shadow" | "block")
              }
              aria-label={t("admin.bannedWords")}
            >
              <option value="shadow">{t("admin.shadowban")}</option>
              <option value="block">{t("admin.block")}</option>
            </select>
            <Button disabled={pending} type="submit">
              {t("admin.add")}
            </Button>
          </form>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {bannedWords.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  <span>{item.word}</span>{" "}
                  <span className="text-muted-foreground">
                    ({item.severity})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run("remove_banned_word", { wordId: item.id })}
                >
                  {t("common.delete")}
                </Button>
              </li>
            ))}
            {!bannedWords.length ? (
              <li className="px-3 py-4 text-sm text-muted-foreground">
                No banned words.
              </li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-xl font-semibold">
            {t("admin.issueWarning")}
          </h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run("warn", { userId, message: warning });
              setWarning("");
            }}
          >
            <Input
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder={t("admin.userId")}
              aria-label={t("admin.userId")}
            />
            <Input
              required
              value={warning}
              onChange={(event) => setWarning(event.target.value)}
              placeholder={t("admin.warningMessage")}
              aria-label={t("admin.warningMessage")}
            />
            <Button disabled={pending} type="submit">
              {t("admin.warnUser")}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
