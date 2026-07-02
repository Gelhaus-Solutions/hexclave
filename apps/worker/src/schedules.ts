import { throwErr } from "@hexclave/shared/dist/utils/errors";
import { ALL_SCHEDULES, getTemporalClient, HEXCLAVE_SCHEDULE_ID_PREFIX, type HexclaveScheduleDefinition } from "@hexclave/temporal";
import { ScheduleAlreadyRunning, ScheduleOverlapPolicy, type ScheduleOptions } from "@temporalio/client";

function buildScheduleOptions(definition: HexclaveScheduleDefinition): ScheduleOptions {
  if (!definition.scheduleId.startsWith(HEXCLAVE_SCHEDULE_ID_PREFIX)) {
    throwErr(`Schedule ID ${definition.scheduleId} must start with ${HEXCLAVE_SCHEDULE_ID_PREFIX} — the startup reconciliation only manages (and can only safely delete) prefixed schedules.`);
  }
  if ((definition.cron == null) === (definition.intervalMs == null)) {
    throwErr(`Schedule ${definition.scheduleId} must set exactly one of cron/intervalMs.`);
  }
  return {
    scheduleId: definition.scheduleId,
    spec: definition.cron != null
      ? { cronExpressions: [definition.cron] }
      : { intervals: [{ every: definition.intervalMs ?? throwErr("unreachable: intervalMs must be set here because the cron/intervalMs exclusivity check above passed") }] },
    action: {
      type: "startWorkflow",
      workflowType: definition.workflowType,
      taskQueue: definition.taskQueue,
      args: definition.args,
    },
    policies: {
      // A tick that is still running suppresses the next one — every current cron consumer
      // (sequencer, cleanup, sweepers) is a batch pass over DB state, so skipped ticks are
      // simply picked up by the next run.
      overlap: ScheduleOverlapPolicy.SKIP,
      // Don't stampede missed ticks after a deploy/outage; one catch-up minute is plenty since
      // the workflows re-read all pending state anyway.
      catchupWindow: "1 minute",
    },
  };
}

/**
 * Idempotently converges the Temporal Schedules in the cluster to ALL_SCHEDULES (code is the
 * source of truth): create → update on conflict, then delete any `hexclave.`-prefixed schedule
 * that is no longer defined in code. Runs at worker startup, before polling begins.
 *
 * Safe for multiple worker replicas racing: create/update/delete all converge to the same
 * state. A failure here crashes the worker on purpose (fail early) — running with stale
 * schedules would silently break cron-dependent subsystems.
 */
export async function upsertSchedules(): Promise<void> {
  const client = await getTemporalClient();
  const desiredIds = new Set(ALL_SCHEDULES.map((definition) => definition.scheduleId));

  for (const definition of ALL_SCHEDULES) {
    const options = buildScheduleOptions(definition);
    try {
      await client.schedule.create(options);
    } catch (error) {
      if (error instanceof ScheduleAlreadyRunning) {
        const handle = client.schedule.getHandle(definition.scheduleId);
        await handle.update((previous) => ({
          ...previous,
          spec: options.spec,
          action: options.action,
          policies: options.policies,
        }));
      } else {
        throw error;
      }
    }
  }

  for await (const summary of client.schedule.list()) {
    if (summary.scheduleId.startsWith(HEXCLAVE_SCHEDULE_ID_PREFIX) && !desiredIds.has(summary.scheduleId)) {
      await client.schedule.getHandle(summary.scheduleId).delete();
    }
  }
}
