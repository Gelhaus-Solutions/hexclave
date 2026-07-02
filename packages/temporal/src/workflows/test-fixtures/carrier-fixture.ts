import { proxyActivities } from "@temporalio/workflow";
import { runCarrierLoop } from "../carrier";

// Test-only workflow used by carrier.test.ts as its workflowsPath entry. Not exported from
// workflows/index.ts, so it never ends up in the production workflow bundle.

type CarrierFixtureActivities = {
  processBatch(): Promise<{ remaining: boolean }>,
};

const { processBatch } = proxyActivities<CarrierFixtureActivities>({
  startToCloseTimeout: "10 seconds",
});

export async function carrierFixtureWorkflow(): Promise<void> {
  return await runCarrierLoop({
    processOneBatch: async () => await processBatch(),
    idleTimeoutMs: 60_000,
    maxHistoryLengthBeforeContinueAsNew: 10_000,
  });
}
