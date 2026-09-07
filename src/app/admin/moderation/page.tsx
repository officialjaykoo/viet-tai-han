import { AdminModeration } from "@/components/admin/admin-moderation";
import { listAdminBannedWords } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const bannedWords = await listAdminBannedWords();
  return <AdminModeration bannedWords={bannedWords} />;
}
