import { proxyActivities } from "@temporalio/workflow";
import type { SmokeTestActivities } from "../activities/types";

const { echo, checkDatabaseConnection } = proxyActivities<SmokeTestActivities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 3,
  },
});

export type SmokeTestWorkflowResult = {
  echoed: string,
  databaseOk: boolean,
};

/**
 * Verifies the whole Temporal round-trip end to end: client → server → worker → activity →
 * backend Prisma access. Started manually (e.g. from the Temporal UI or the E2E helper) to
 * validate a deployment.
 */
export async function smokeTestWorkflow(input: string): Promise<SmokeTestWorkflowResult> {
  const echoed = await echo(input);
  const databaseOk = (await checkDatabaseConnection()).ok;
  return { echoed, databaseOk };
}
