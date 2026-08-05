import type { Metadata } from "next";

import { ErrorScreen } from "@/components/errors/error-screen";

export const metadata: Metadata = {
  title: "405",
  robots: { index: false, follow: false },
};

export default async function MethodNotAllowedPage() {
  return <ErrorScreen code="405" />;
}
