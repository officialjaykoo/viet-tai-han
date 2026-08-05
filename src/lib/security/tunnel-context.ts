import { AsyncLocalStorage } from "node:async_hooks";

export type TunnelContext = {
  verified: true;
  /** Decoded JSON payload when Content-Type was JSON; otherwise null. */
  json: unknown;
  raw: Uint8Array;
  ip: string;
  /** Optional binary upload metadata. */
  contentType?: string | null;
  filename?: string | null;
};

const storage = new AsyncLocalStorage<TunnelContext>();

export function getTunnelContext(): TunnelContext | null {
  return storage.getStore() ?? null;
}

export function runWithTunnelContext<T>(
  ctx: TunnelContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn);
}
