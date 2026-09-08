export type ConsumerNavSection =
  | "home"
  | "communities"
  | "questions"
  | "marketplace"
  | "businesses"
  | "messages"
  | "notifications"
  | "profile"
  | "friends"
  | "settings"
  | "recommended";

export function navSectionForPath(
  pathname: string
): ConsumerNavSection | null {
  if (pathname === "/") return "home";
  if (pathname === "/communities" || pathname.startsWith("/r/")) {
    return "communities";
  }
  if (pathname === "/questions" || pathname.startsWith("/questions/")) {
    return "questions";
  }
  if (
    pathname === "/marketplace" ||
    pathname.startsWith("/marketplace/")
  ) {
    return "marketplace";
  }
  if (pathname === "/businesses" || pathname.startsWith("/businesses/")) {
    return "businesses";
  }
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return "messages";
  }
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/friends") return "friends";
  if (pathname === "/settings") return "settings";
  if (pathname === "/recommended") return "recommended";
  if (pathname === "/u" || pathname.startsWith("/u/")) return "profile";
  return null;
}

export function isNavSectionActive(
  pathname: string,
  section: ConsumerNavSection
): boolean {
  return navSectionForPath(pathname) === section;
}
