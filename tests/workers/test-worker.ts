/**
 * Slim Worker entry for vitest-pool-workers (local tests only — not deployed).
 */
export { ChatRoom } from "../../src/workers/ChatRoom";

export default {
  async fetch() {
    return new Response("test worker", { status: 200 });
  },
} satisfies ExportedHandler;
