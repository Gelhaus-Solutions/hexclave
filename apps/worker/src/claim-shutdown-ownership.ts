import { globalVar } from "@hexclave/shared/dist/utils/globals";

// apps/backend/src/prisma-client.tsx registers a SIGTERM handler at import time (drain for 8s,
// then $disconnect all Prisma clients) unless this guard is already set. In the worker process
// that handler would tear down Prisma while Temporal activities are still draining under the
// worker's shutdownGraceTime, so we claim shutdown ownership here — this module MUST be
// imported before anything that (transitively) imports backend code. The worker's own shutdown
// path (src/shutdown.ts + the tail of src/index.ts) takes over the draining duties.
globalVar.__hexclave_prisma_sigterm_registered = true;

export {};
