import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRequestLocale,
  getSession,
  getSubredditByName,
  notFound,
  redirect,
  redirectIfIncompleteOnboarding,
} = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  getSession: vi.fn(),
  getSubredditByName: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  redirectIfIncompleteOnboarding: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: () => null }));
vi.mock("@/components/layout/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/posts/create-post-form", () => ({
  CreatePostForm: () => null,
}));
vi.mock("@/lib/content", () => ({ getSubredditByName }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale }));
vi.mock("@/lib/i18n/translate", () => ({
  tLocale: (_locale: string, key: string) => key,
}));
vi.mock("@/lib/onboarding-access", () => ({ redirectIfIncompleteOnboarding }));
vi.mock("@/lib/session", () => ({ getSession }));

import SubmitInSubredditPage from "@/app/r/[name]/submit/page";

describe("profile community submit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubredditByName.mockResolvedValue(null);
  });

  it("does not render another user's internal profile target", async () => {
    getSession.mockResolvedValue({
      user: { id: "bob", username: "bob", name: "Bob" },
    });
    redirectIfIncompleteOnboarding.mockResolvedValue(undefined);

    await expect(
      SubmitInSubredditPage({
        params: Promise.resolve({ name: "u_alice" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("keeps the current user's profile route available", async () => {
    getSession.mockResolvedValue({
      user: { id: "alice", username: "alice", name: "Alice" },
    });
    redirectIfIncompleteOnboarding.mockResolvedValue(undefined);
    getRequestLocale.mockResolvedValue({ locale: "vi" });

    await expect(
      SubmitInSubredditPage({
        params: Promise.resolve({ name: "u_alice" }),
      })
    ).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("does not render a profile name owned by another database user", async () => {
    getSession.mockResolvedValue({
      user: { id: "alice", username: "alice", name: "Alice" },
    });
    redirectIfIncompleteOnboarding.mockResolvedValue(undefined);
    getSubredditByName.mockResolvedValue({
      is_removed: 0,
      created_by: "bob",
    });

    await expect(
      SubmitInSubredditPage({
        params: Promise.resolve({ name: "u_alice" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
