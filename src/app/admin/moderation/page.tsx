import { AdminModeration } from "@/components/admin/admin-moderation";
import { listAdminBannedWords } from "@/lib/admin";
import { listBurstPosts } from "@/lib/score-integrity";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const [bannedWords, burstPosts] = await Promise.all([listAdminBannedWords(), listBurstPosts(20)]);
  return <AdminModeration bannedWords={bannedWords} burstPosts={burstPosts} />;
}
