"use client";

import type { ReactNode } from "react";

import {
  hydrateSession,
  type PublicAuthSession,
} from "@/lib/auth-client";

export function AuthSessionHydrator({
  initialSession,
  children,
}: {
  initialSession: PublicAuthSession | null;
  children: ReactNode;
}) {
  hydrateSession(initialSession);
  return <>{children}</>;
}
