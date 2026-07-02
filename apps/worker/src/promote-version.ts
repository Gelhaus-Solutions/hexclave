import { throwErr } from "@hexclave/shared/dist/utils/errors";
import { wait } from "@hexclave/shared/dist/utils/promises";
import { getTemporalClient, getTemporalConnectionEnvConfig } from "@hexclave/temporal";

/**
 * Promotes this worker's deployment version (deploymentName + buildId) to Current, so
 * AUTO_UPGRADE workflows move over to it. Temporal does NOT do this automatically on deploy —
 * normally it's an operator step (`temporal worker deployment set-current-version`); for our
 * single-operator setup the worker promotes itself at startup, gated by
 * HEXCLAVE_TEMPORAL_AUTO_PROMOTE (default on) so that a canary/ramp flow can be adopted later
 * by turning this off and promoting manually.
 *
 * The Worker Deployment API surface is experimental and has churned across SDK minors — keep
 * every raw workflowService call related to versioning isolated in this file.
 */
export async function promoteWorkerDeploymentVersionToCurrent(options: {
  deploymentName: string,
  buildId: string,
}): Promise<void> {
  const client = await getTemporalClient();
  const namespace = getTemporalConnectionEnvConfig().namespace;
  const service = client.connection.workflowService;
  const version = `${options.deploymentName}.${options.buildId}`;

  // The version only becomes promotable once the server has seen this worker's pollers, which
  // happens shortly after worker.run() starts — hence the bounded poll loop.
  const deadlineMs = performance.now() + 120_000;
  while (true) {
    const response = await service.describeWorkerDeployment({
      namespace,
      deploymentName: options.deploymentName,
    }).catch((error: unknown) => {
      // NOT_FOUND is expected until the first poller of this deployment registers.
      if (isGrpcStatus(error, GRPC_STATUS_NOT_FOUND)) {
        return undefined;
      }
      throw error;
    });

    const info = response?.workerDeploymentInfo;
    if (info?.routingConfig?.currentVersion === version) {
      return;
    }
    if (response != null && (info?.versionSummaries ?? []).some((summary) => summary.version === version)) {
      try {
        await service.setWorkerDeploymentCurrentVersion({
          namespace,
          deploymentName: options.deploymentName,
          version,
          conflictToken: response.conflictToken,
          // Old task queues may still be registered from previous versions; don't block the
          // promotion on them.
          ignoreMissingTaskQueues: true,
        });
        return;
      } catch (error) {
        // Another replica of the same build racing the promotion bumps the conflict token;
        // re-describe and retry. Anything else is a real error.
        if (!isGrpcStatus(error, GRPC_STATUS_FAILED_PRECONDITION)) {
          throw error;
        }
      }
    }

    if (performance.now() > deadlineMs) {
      throwErr(`Timed out waiting to promote worker deployment version ${version} to Current. The worker is polling, but the version never showed up in describeWorkerDeployment — is worker versioning enabled on the Temporal cluster (dynamic config system.enableDeploymentVersions)?`);
    }
    await wait(2000);
  }
}

const GRPC_STATUS_NOT_FOUND = 5;
const GRPC_STATUS_FAILED_PRECONDITION = 9;

function isGrpcStatus(error: unknown, code: number): boolean {
  return typeof error === "object" && error != null && "code" in error && (error as { code: unknown }).code === code;
}
