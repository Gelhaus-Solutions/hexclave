import type { Worker } from "@temporalio/worker";

/**
 * On SIGTERM/SIGINT, ask the worker to shut down gracefully: it stops polling, in-flight
 * activities get up to shutdownGraceTime (see Worker.create in index.ts) to finish, and then
 * worker.run() resolves. In-flight workflow tasks simply get retried by another worker (or this
 * one after restart) — that's Temporal's normal recovery path, so a dev tsx-watch restart or a
 * prod `docker stop` is safe at any time.
 */
export function registerShutdownHandlers(worker: Worker): void {
  let shuttingDown = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down Temporal worker gracefully...`);
      worker.shutdown();
    });
  }
}
