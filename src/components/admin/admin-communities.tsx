"use client";

import { useState } from "react";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AdminCommunity } from "@/lib/admin";

export function AdminCommunities({ communities }: { communities: AdminCommunity[] }) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  function createCommunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run("create_subreddit", { name, title, description });
    setName("");
    setTitle("");
    setDescription("");
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("communities.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("communities.browseBlurb")}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-xl font-semibold">{t("communities.createCommunity")}</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={createCommunity}>
          <Input required minLength={3} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("communities.namePlaceholder")} aria-label={t("communities.name")} />
          <Input required minLength={3} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("communities.titlePlaceholder")} aria-label={t("communities.communityTitle")} />
          <Textarea className="sm:col-span-2" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("communities.descriptionPlaceholder")} aria-label={t("communities.description")} />
          <div className="sm:col-span-2">
            <Button disabled={pending} type="submit">{t("communities.create")}</Button>
          </div>
        </form>
      </section>

      <AdminFeedback error={error} message={message} />

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">{t("communities.directory")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("communities.name")}</th>
                <th className="px-4 py-3">{t("communities.communityTitle")}</th>
                <th className="px-4 py-3">{t("communities.members")}</th>
                <th className="px-4 py-3">Posts</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">{t("common.edit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {communities.map((community) => (
                <tr key={community.id} className={community.status === "removed" ? "opacity-60" : undefined}>
                  <td className="px-4 py-3 font-medium">r/{community.name}</td>
                  <td className="px-4 py-3">
                    {editingId === community.id ? (
                      <div className="space-y-2">
                        <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label={t("communities.communityTitle")} />
                        <Textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} aria-label={t("communities.description")} />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={pending} onClick={() => { run("update_subreddit", { subredditId: community.id, title: editTitle, description: editDescription }); setEditingId(null); }}>{t("common.save")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t("common.cancel")}</Button>
                        </div>
                      </div>
                    ) : community.title}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{community.memberCount}</td>
                  <td className="px-4 py-3 tabular-nums">{community.postCount}</td>
                  <td className="px-4 py-3">{community.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {community.status === "active" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(community.id); setEditTitle(community.title); setEditDescription(community.description ?? ""); }}>{t("common.edit")}</Button>
                          <Button size="sm" variant="destructive" disabled={pending} onClick={() => { if (window.confirm("Remove this community?")) run("delete_subreddit", { subredditId: community.id, reason: "Admin removal" }); }}>{t("common.delete")}</Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!communities.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No communities.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
