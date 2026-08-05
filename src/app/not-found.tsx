import { ErrorScreen } from "@/components/errors/error-screen";

export default async function NotFound() {
  return <ErrorScreen code="404" />;
}
