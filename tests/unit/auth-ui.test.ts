import { describe, expect, it } from "vitest";

import { resolveAuthUiState } from "@/lib/auth-ui";

const authenticatedSession = { user: { id: "user-1" } };

function state(
  overrides: Partial<Parameters<typeof resolveAuthUiState>[0]> = {}
) {
  return resolveAuthUiState({
    hydrated: true,
    session: null,
    isPending: false,
    error: null,
    ...overrides,
  });
}

describe("auth UI state", () => {
  it("does not show guest state while the session request is pending", () => {
    expect(state({ isPending: true })).toBe("loading");
  });

  it("does not show guest state when session refresh fails", () => {
    expect(state({ error: { status: 503 } })).toBe("unknown");
  });

  it("keeps an available session authoritative during a refresh error", () => {
    expect(
      state({ session: authenticatedSession, error: { status: 503 } })
    ).toBe("authenticated");
  });

  it("treats an explicit unauthorized response as anonymous", () => {
    expect(state({ error: { status: 401 } })).toBe("anonymous");
  });

  it("returns authenticated only for a session with a user", () => {
    expect(state({ session: authenticatedSession })).toBe("authenticated");
  });

  it("returns anonymous after a successful empty session response", () => {
    expect(state()).toBe("anonymous");
  });
});
