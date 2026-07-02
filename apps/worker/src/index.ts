// MUST be the first import: claims SIGTERM ownership before any backend module (which register
// their own handlers at import time) is loaded.
import "./claim-shutdown-ownership";

import { createBackendTemporalActivities, drainInFlightPromises, ensurePolyfilled } from "@hexclave/backend/temporal-activities";
import { getEnvVariable, getNodeEnvironment } from "@hexclave/shared/dist/utils/env";
import { wait } from "@hexclave/shared/dist/utils/promises";
import { getTemporalConnectionEnvConfig, MAIN_TASK_QUEUE, type TemporalConnectionEnvConfig } from "@hexclave/temporal";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createRequire } from "node:module";
import path from "node:path";
import { sentryActivityInterceptorFactory } from "./interceptors";
import { promoteWorkerDeploymentVersionToCurrent } from "./promote-version";
import { upsertSchedules } from "./schedules";
import { initSentry } from "./sentry";
import { registerShutdownHandlers } from "./shutdown";
import { getWorkerDeploymentOptions } from "./worker-options";

function getWorkflowsPath(): string {
  // Point the workflow bundler at the package's TypeScript source (the SDK's bundler compiles
  // TS itself). Resolving via package.json instead of the package's exports map keeps this
  // independent of whether dist/ has been built yet — important on first dev boot, where the
  // tsdown watcher may not have produced dist output for a brand-new package.
  const require = createRequire(import.meta.url);
  const temporalPackageJsonPath = require.resolve("@hexclave/temporal/package.json");
  return path.join(path.dirname(temporalPackageJsonPath), "src/workflows/index.ts");
}

async function connectWithRetry(config: TemporalConnectionEnvConfig): Promise<NativeConnection> {
  // `pnpm dev` doesn't order the worker against docker-compose, so the Temporal container may
  // still be starting. Retry for a bounded window, then fail loud.
  const deadlineMs = performance.now() + 60_000;
  let attempt = 0;
  while (true) {
    try {
      return await NativeConnection.connect({
        address: config.address,
        tls: config.tls,
      });
    } catch (error) {
      attempt++;
      if (performance.now() > deadlineMs) {
        console.error(`Could not connect to Temporal at ${config.address} within 60s. Is the Temporal dev dependency running? (pnpm restart-deps)`);
        throw error;
      }
      const delayMs = Math.min(5_000, 500 * 2 ** attempt);
      console.log(`Temporal at ${config.address} not reachable yet (attempt ${attempt}), retrying in ${delayMs}ms...`);
      await wait(delayMs);
    }
  }
}

async function main(): Promise<void> {
  // Expands ${NEXT_PUBLIC_HEXCLAVE_PORT_PREFIX:-81} placeholders in env values and registers
  // the shared error sink — must happen before any env-derived config is read.
  ensurePolyfilled();
  initSentry();
  process.title = `hexclave-worker:${getEnvVariable("NEXT_PUBLIC_HEXCLAVE_PORT_PREFIX", "81")} (node/temporal)`;

  const config = getTemporalConnectionEnvConfig();
  const connection = await connectWithRetry(config);
  await upsertSchedules();

  const deploymentOptions = getWorkerDeploymentOptions();
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: getEnvVariable("HEXCLAVE_TEMPORAL_TASK_QUEUE", MAIN_TASK_QUEUE),
    workflowsPath: getWorkflowsPath(),
    activities: createBackendTemporalActivities(),
    interceptors: {
      activity: [sentryActivityInterceptorFactory],
    },
    shutdownGraceTime: getNodeEnvironment() === "development" ? "5 seconds" : "30 seconds",
    ...deploymentOptions != null ? { workerDeploymentOptions: deploymentOptions } : {},
  });
  registerShutdownHandlers(worker);

  console.log(`Hexclave Temporal worker starting (namespace=${config.namespace}, taskQueue=${MAIN_TASK_QUEUE}, versioning=${deploymentOptions != null ? deploymentOptions.version.buildId : "off"})`);
  const runPromise = worker.run();

  if (deploymentOptions != null && getEnvVariable("HEXCLAVE_TEMPORAL_AUTO_PROMOTE", "true") === "true") {
    try {
      await promoteWorkerDeploymentVersionToCurrent(deploymentOptions.version);
      console.log(`Promoted worker deployment version ${deploymentOptions.version.deploymentName}.${deploymentOptions.version.buildId} to Current.`);
    } catch (error) {
      // Fail loud: an unpromoted new version receives no AUTO_UPGRADE workflow tasks, which is
      // a silently broken deploy. Shut the worker down and crash so the deploy is visibly bad.
      worker.shutdown();
      await runPromise;
      throw error;
    }
  }

  await runPromise;

  // Mirror the backend's SIGTERM behavior (see prisma-client.tsx, whose handler we disabled in
  // claim-shutdown-ownership.ts): give fire-and-forget promises a moment to settle. Prisma
  // connections close with the process.
  await drainInFlightPromises(8_000);
  console.log("Hexclave Temporal worker shut down cleanly.");
}

// Top-level await: an error here crashes the process with a non-zero exit code and a
// stacktrace, which is exactly what we want (fail early, fail loud).
await main();
