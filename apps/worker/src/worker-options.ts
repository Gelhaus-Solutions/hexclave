import { getEnvVariable } from "@hexclave/shared/dist/utils/env";
import type { WorkerDeploymentOptions } from "@temporalio/worker";

export function getDeploymentName(): string {
  return getEnvVariable("HEXCLAVE_TEMPORAL_DEPLOYMENT_NAME", "hexclave-worker");
}

/**
 * Worker Deployment Versioning (https://docs.temporal.io/worker-deployments) configuration.
 *
 * The build ID is the 6-char git commit SHA, baked into the prod image as
 * HEXCLAVE_GIT_COMMIT_SHA (VERCEL_GIT_COMMIT_SHA works as a fallback). When no SHA is available
 * (local dev), versioning is disabled entirely — with tsx watch restarting the worker on every
 * file save, a versioned dev worker would strand a deployment version per restart and stall
 * task routing against the local cluster.
 */
export function getWorkerDeploymentOptions(): WorkerDeploymentOptions | undefined {
  const sha = getEnvVariable("HEXCLAVE_GIT_COMMIT_SHA", getEnvVariable("VERCEL_GIT_COMMIT_SHA", ""));
  if (sha === "") {
    return undefined;
  }
  return {
    useWorkerVersioning: true,
    version: {
      deploymentName: getDeploymentName(),
      buildId: sha.slice(0, 6),
    },
    defaultVersioningBehavior: "AUTO_UPGRADE",
  };
}
