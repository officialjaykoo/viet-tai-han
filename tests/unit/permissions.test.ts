import { describe, expect, it } from "vitest";

import { requireAdmin, requireActiveUser } from "@/lib/permissions";
import { AuthError } from "@/lib/session";

describe("permissions", () => {
  it("blocks banned users", async () => {
    await expect(
      requireActiveUser({
        id: "u1",
        name: "Banned",
        email: "b@example.com",
        status: "banned",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("requires admin role", async () => {
    await expect(
      requireAdmin({
        id: "u1",
        name: "User",
        email: "u@example.com",
        role: "user",
        status: "active",
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows admins", async () => {
    const user = await requireAdmin({
      id: "u1",
      name: "Admin",
      email: "a@example.com",
      role: "admin",
      status: "active",
    });
    expect(user.role).toBe("admin");
  });
});
