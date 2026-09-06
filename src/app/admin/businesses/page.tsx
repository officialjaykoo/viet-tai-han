import { AdminBusinesses } from "@/components/admin/admin-businesses";
import { listBusinessVerificationQueue } from "@/lib/businesses";

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage() {
  const verifications = await listBusinessVerificationQueue("pending");
  return <AdminBusinesses verifications={verifications} />;
}
