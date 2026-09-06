import { AdminUsers } from "@/components/admin/admin-users";
import { listAdminUsers } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const users = await listAdminUsers({ search: query, limit: 50, offset: (page - 1) * 50 });
  return <AdminUsers users={users} query={query} page={page} />;
}
