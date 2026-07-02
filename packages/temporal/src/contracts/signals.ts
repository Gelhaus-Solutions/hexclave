import { defineSignal } from "@temporalio/workflow";

// defineSignal only creates metadata (no workflow-sandbox APIs are touched), so this module is
// safe to import from both workflow code and regular Node code (backend/worker clients).

/**
 * The wake-up signal shared by all carrier (per-tenancy entity) workflows.
 *
 * Signals are hints, not work: they carry no payload, and carriers always re-read their pending
 * work from Postgres inside an activity. This makes duplicate and lost signals harmless (the
 * per-subsystem sweeper schedule re-signals for rows that sat unclaimed too long) and lets N
 * enqueues coalesce into one batch pass.
 */
export const carrierWakeSignal = defineSignal("hexclave-carrier-wake");
