/**
 * Slim Worker entry for vitest-pool-workers (local tests only — not deployed).
 */
export { PostObject } from "../../src/workers/PostObject";

export default {
  async fetch() {
    return new Response("red test worker", { status: 200 });
  },
} satisfies ExportedHandler;
