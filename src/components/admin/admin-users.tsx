"use client";

import Link from "next/link";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUser } from "@/lib/admin";

export function AdminUsers({
  users,
  query,
  page,
}: {
  users: AdminUser[];
  query: string;
  page: number;
}) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  const previous = page > 1 ? `/admin/users?q=${encodeURIComponent(query)}&page=${page - 1}` : null;
  const next = users.length === 50 ? `/admin/users?q=${encodeURIComponent(query)}&page=${page + 1}` : null;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("admin.users")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Search accounts and apply status actions.</p>
      </section>
      <form className="flex max-w-xl gap-2" method="get">
        <Input name="q" defaultValue={query} placeholder={t("admin.userId")} aria-label={t("admin.users")} />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <AdminFeedback error={error} message={message} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Karma</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <Link className="font-medium hover:underline" href={user.username ? `/u/${user.username}` : "#"}>{user.username ? `@${user.username}` : user.name}</Link>
                  <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">{user.id}</p>
                </td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.status}</td>
                <td className="px-4 py-3 tabular-nums">{user.karma}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.status === "banned" ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("user_status", { userId: user.id, action: "unban" })}>{t("admin.unban")}</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("user_status", { userId: user.id, action: "ban", reason: "Admin action" })}>{t("admin.ban")}</Button>
                    )}
                    {user.status === "shadowbanned" ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("user_status", { userId: user.id, action: "unshadowban" })}>{t("admin.unshadowban")}</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("user_status", { userId: user.id, action: "shadowban", reason: "Admin action" })}>{t("admin.shadowban")}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!users.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        {previous ? <Link className="inline-flex h-8 items-center rounded-4xl border border-border px-3 text-sm font-medium hover:bg-muted" href={previous}>{t("common.back")}</Link> : <span />}
        {next ? <Link className="inline-flex h-8 items-center rounded-4xl border border-border px-3 text-sm font-medium hover:bg-muted" href={next}>Next</Link> : null}
      </div>
    </div>
  );
}
