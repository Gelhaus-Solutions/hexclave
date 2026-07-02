/**
 * All Temporal Schedule IDs owned by Hexclave are prefixed with this so that the worker's
 * startup reconciliation can safely delete schedules that were removed from code without
 * touching schedules an operator may have created manually.
 */
export const HEXCLAVE_SCHEDULE_ID_PREFIX = "hexclave.";

export type HexclaveScheduleDefinition = {
  /** Must start with HEXCLAVE_SCHEDULE_ID_PREFIX. */
  scheduleId: string,
  description: string,
  /** Exactly one of cron or intervalMs must be set. */
  cron?: string,
  intervalMs?: number,
  workflowType: string,
  taskQueue: string,
  args: unknown[],
};

/**
 * Declarative source of truth for all schedules. The worker upserts these idempotently at
 * startup (create → update on conflict) and deletes any `hexclave.`-prefixed schedule that is
 * no longer listed here, so removing an entry here is all that's needed to retire a schedule.
 *
 * Subsystem migrations append their schedules (sweepers, daily crons, keeper schedules) here.
 */
export const ALL_SCHEDULES: HexclaveScheduleDefinition[] = [];
