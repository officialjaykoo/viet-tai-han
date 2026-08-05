/**
 * Stubs @opennextjs/cloudflare so app libs can call getDb()/getEnv()
 * inside the Cloudflare vitest workers pool.
 */
import { env } from "cloudflare:test";

export async function getCloudflareContext(_opts?: { async?: boolean }) {
  return {
    env,
    cf: {},
    ctx: {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    },
  };
}
