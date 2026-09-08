import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api-client";
import {
  SettingsRequestError,
  settingsRequest,
} from "@/components/settings/settings-action";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("settings async action handling", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("turns network failures into a handled status-zero error", async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error("tunnel failed"));
    await expect(
      settingsRequest("/api/me/settings", {}, "Save failed")
    ).rejects.toMatchObject<Partial<SettingsRequestError>>({ status: 0 });
  });

  it("rejects non-ok and malformed successful responses", async () => {
    mockedApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    );
    await expect(
      settingsRequest("/api/me/settings", {}, "Save failed")
    ).rejects.toMatchObject({ status: 403, message: "Forbidden" });

    mockedApiFetch.mockResolvedValueOnce(
      new Response("not-json", { status: 200 })
    );
    await expect(
      settingsRequest("/api/me/settings", {}, "Save failed")
    ).rejects.toMatchObject({ status: 200, message: "Save failed" });
  });
  it("rejects a successful response that still carries an error", async () => {
    mockedApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid settings payload" }), {
        status: 200,
      })
    );
    await expect(
      settingsRequest("/api/me/settings", {}, "Save failed")
    ).rejects.toMatchObject({
      status: 200,
      message: "Invalid settings payload",
    });
  });
});
