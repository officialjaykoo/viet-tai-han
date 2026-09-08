import { redirect } from "next/navigation";

import { getSafeAuthNext } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

type SignupPageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined;
  }>;
};

export default async function SignupPage({
  searchParams,
}: SignupPageProps) {
  const { next } = await searchParams;
  const safeNext = getSafeAuthNext(next);
  const session = await getSession();

  if (session?.user) {
    redirect(safeNext);
  }

  redirect(
    safeNext === "/"
      ? "/login"
      : `/login?next=${encodeURIComponent(safeNext)}`
  );
}
