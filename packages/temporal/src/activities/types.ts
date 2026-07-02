/**
 * Activity *interfaces* only — implementations live in the backend
 * (apps/backend/src/temporal/activities.ts) and are registered by apps/worker.
 *
 * Everything crossing the workflow/activity boundary must be JSON-serializable plain data
 * (Temporal serializes all payloads): pass tenancy IDs, never Tenancy objects or Prisma models.
 */

export type SmokeTestActivities = {
  /** Returns its input; proves workflow→activity round-trips work. */
  echo(input: string): Promise<string>,
  /** Runs a trivial query against the read replica; proves the worker's Prisma access works. */
  checkDatabaseConnection(): Promise<{ ok: boolean }>,
};

/**
 * The full set of activities the worker registers. Subsystem migrations extend this via
 * intersection, e.g. `SmokeTestActivities & EmailActivities & ...`.
 */
export type HexclaveActivities = SmokeTestActivities;
