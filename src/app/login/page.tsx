import { SocialAuthPage } from "@/components/auth/social-auth-form";

import { redirect } from "next/navigation";

import { getSafeAuthNext } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

type AuthPageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined;
  }>;
};

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const session = await getSession();
  if (session?.user) {
    const { next } = await searchParams;
    redirect(getSafeAuthNext(next));
  }

  return <SocialAuthPage />;
}
