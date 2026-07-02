import { captureError } from "@hexclave/shared/dist/utils/errors";
import type { WorkflowHandle } from "@temporalio/client";
import { getTemporalClient } from "./client";
import { carrierWakeSignal } from "./contracts/signals";
import { MAIN_TASK_QUEUE } from "./task-queues";
import { SMOKE_TEST_WORKFLOW_TYPE } from "./workflow-types";
import type { SmokeTestWorkflowResult } from "./workflows/smoke-test";

/**
 * Wakes up a carrier workflow, starting it if it isn't running (signalWithStart).
 *
 * This is the post-commit half of the standard handoff pattern: the caller has already
 * committed an intent row to Postgres in its own transaction, so this call is best-effort by
 * design — if Temporal is briefly unreachable, we log the error and return instead of failing
 * the user-facing request, and the subsystem's sweeper schedule re-signals the carrier for
 * unclaimed intent rows.
 */
export async function signalCarrierWithStartBestEffort(options: {
  workflowType: string,
  workflowId: string,
  taskQueue?: string,
}): Promise<void> {
  try {
    const client = await getTemporalClient();
    await client.workflow.signalWithStart(options.workflowType, {
      workflowId: options.workflowId,
      taskQueue: options.taskQueue ?? MAIN_TASK_QUEUE,
      args: [],
      signal: carrierWakeSignal,
      signalArgs: [],
    });
  } catch (error) {
    // Deliberately swallowed after logging: the DB intent row is the source of truth and the
    // sweeper schedule repairs lost signals, so a Temporal hiccup must not fail the request.
    captureError(`temporal-signal-carrier-with-start:${options.workflowId}`, error);
  }
}

/**
 * Starts the deployment smoke-test workflow. NOT best-effort — callers (E2E tests, manual
 * verification) want the error if Temporal is unreachable.
 */
export async function startSmokeTestWorkflow(input: string, options?: { workflowIdSuffix?: string }): Promise<WorkflowHandle> {
  const client = await getTemporalClient();
  return await client.workflow.start<(input: string) => Promise<SmokeTestWorkflowResult>>(SMOKE_TEST_WORKFLOW_TYPE, {
    workflowId: `smoke-test--${options?.workflowIdSuffix ?? "manual"}`,
    taskQueue: MAIN_TASK_QUEUE,
    args: [input],
  });
}
