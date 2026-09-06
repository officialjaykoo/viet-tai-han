import { getCloudflareContext } from "@opennextjs/cloudflare";

type BackgroundWork = () => Promise<unknown>;

function logBackgroundFailure(label: string, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "background_task_failed",
      task: label,
      error: error instanceof Error ? error.message : String(error),
    })
  );
}

/** Run best-effort work with a Worker lifecycle completion opportunity. */
export function runBackgroundTask(label: string, work: BackgroundWork): void {
  const task = Promise.resolve().then(work).catch((error) => {
    logBackgroundFailure(label, error);
  });

  void (async () => {
    try {
      const { ctx } = await getCloudflareContext({ async: true });
      if (ctx?.waitUntil) {
        ctx.waitUntil(task);
        return;
      }
    } catch {
      // Local Node/test contexts do not expose a Worker execution context.
    }
    await task;
  })();
}
