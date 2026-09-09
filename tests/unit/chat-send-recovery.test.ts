import { describe, expect, it, vi } from "vitest";

import { retryOnceAfterTransportError } from "@/lib/chat-send-recovery";

describe("chat send transport recovery", () => {
  it("keeps the fast path to one attempt", async () => {
    const operation = vi.fn().mockResolvedValue("canonical");

    await expect(retryOnceAfterTransportError(operation)).resolves.toEqual({
      value: "canonical",
      retried: false,
    });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("retries once after a transport error", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce("canonical");

    await expect(retryOnceAfterTransportError(operation)).resolves.toEqual({
      value: "canonical",
      retried: true,
    });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry forever when transport remains unavailable", async () => {
    const firstError = new Error("request lost");
    const operation = vi.fn().mockRejectedValue(firstError);

    await expect(retryOnceAfterTransportError(operation)).rejects.toBe(
      firstError
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
