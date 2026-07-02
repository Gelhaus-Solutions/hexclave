/**
 * Backend-safe entry point of @hexclave/temporal.
 *
 * Exposes the Temporal client, typed start/signal helpers, workflow type/ID/schedule constants,
 * and activity *interfaces*. It must never (transitively) export workflow implementations —
 * those live behind the separate `@hexclave/temporal/workflows` entry, which only the worker's
 * workflow bundler may load.
 */

export { getTemporalClient } from "./client";
export { startSmokeTestWorkflow, signalCarrierWithStartBestEffort } from "./client-helpers";
export { carrierWakeSignal } from "./contracts/signals";
export { getTemporalConnectionEnvConfig, type TemporalConnectionEnvConfig } from "./env";
export { ALL_SCHEDULES, HEXCLAVE_SCHEDULE_ID_PREFIX, type HexclaveScheduleDefinition } from "./schedules";
export { MAIN_TASK_QUEUE } from "./task-queues";
export { getCarrierWorkflowId, type CarrierSubsystem } from "./workflow-ids";
export { SMOKE_TEST_WORKFLOW_TYPE } from "./workflow-types";
export type { HexclaveActivities, SmokeTestActivities } from "./activities/types";
