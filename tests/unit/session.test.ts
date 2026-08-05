import { describe, expect, it } from "vitest";

import { AuthError } from "@/lib/session";

describe("AuthError", () => {
  it("defaults to 401", () => {
    const error = new AuthError("Authentication required");
    expect(error.status).toBe(401);
    expect(error.message).toBe("Authentication required");
  });

  it("supports forbidden status for banned accounts", () => {
    const error = new AuthError("Account is banned", 403);
    expect(error.status).toBe(403);
  });
});
