import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carrierWakeSignal } from "../contracts/signals";

// These tests spin up Temporal's time-skipping test server (downloaded to ~/.temporalio on
// first run), so the idle timeout in runCarrierLoop is fast-forwarded instead of waited out.

const TASK_QUEUE = "carrier-test";
const workflowsPath = fileURLToPath(new URL("./test-fixtures/carrier-fixture.ts", import.meta.url));

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
});

afterAll(async () => {
  await testEnv.teardown();
});

describe("runCarrierLoop", () => {
  it("keeps processing batches while work remains, then completes when idle", async () => {
    let batchCalls = 0;
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: {
        processBatch: async () => {
          batchCalls++;
          return { remaining: batchCalls < 3 };
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.signalWithStart("carrierFixtureWorkflow", {
        workflowId: "carrier-fixture--drain-then-idle",
        taskQueue: TASK_QUEUE,
        args: [],
        signal: carrierWakeSignal,
        signalArgs: [],
      });
      await handle.result();
    });

    // 3 passes: two report remaining work, the third drains the backlog; after that the idle
    // timeout (time-skipped) completes the workflow.
    expect(batchCalls).toBe(3);
  });

  it("coalesces signals received during a batch pass into one extra pass", async () => {
    let batchCalls = 0;
    // Two-way latch so the extra signals deterministically arrive *while* the first batch pass
    // is in flight (after the loop has claimed its wake-ups, before the pass completes).
    let firstBatchStarted!: () => void;
    const firstBatchStartedPromise = new Promise<void>((resolve) => {
      firstBatchStarted = resolve;
    });
    let releaseFirstBatch!: () => void;
    const firstBatchGate = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: {
        processBatch: async () => {
          batchCalls++;
          if (batchCalls === 1) {
            firstBatchStarted();
            await firstBatchGate;
          }
          return { remaining: false };
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.signalWithStart("carrierFixtureWorkflow", {
        workflowId: "carrier-fixture--coalescing",
        taskQueue: TASK_QUEUE,
        args: [],
        signal: carrierWakeSignal,
        signalArgs: [],
      });
      await firstBatchStartedPromise;
      // Several enqueues arrive while the first batch is still being processed...
      await handle.signal(carrierWakeSignal);
      await handle.signal(carrierWakeSignal);
      await handle.signal(carrierWakeSignal);
      releaseFirstBatch();
      await handle.result();
    });

    // ...and coalesce into exactly one follow-up pass (which re-reads the DB and finds all of
    // them), rather than one pass per signal.
    expect(batchCalls).toBe(2);
  });
});
