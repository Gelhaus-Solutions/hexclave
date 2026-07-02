/**
 * The curated seam between the backend and the Temporal worker (apps/worker).
 *
 * This is the ONLY module apps/worker may import from the backend (enforced by an eslint
 * no-restricted-imports rule over there, plus its smoke-import-activities script which fails if
 * this file's transitive import graph pulls in Next.js-only modules). Keep the surface small
 * and auditable: activity implementations plus the handful of lifecycle helpers the worker
 * process needs. Anything the worker newly requires must be re-exported here, never deep-imported.
 *
 * Everything imported here must be plain-Node safe — no next/headers, no server-only, no
 * route-handler/request context. Activity implementations receive and return JSON-serializable
 * plain data only (tenancy IDs, not Tenancy objects), matching the interfaces declared in
 * packages/temporal/src/activities/types.ts.
 */

import type { HexclaveActivities } from "@hexclave/temporal";
import { globalPrismaClient } from "../prisma-client";

export { ensurePolyfilled } from "../polyfills";
export { drainInFlightPromises } from "../utils/background-tasks";

export function createBackendTemporalActivities(): HexclaveActivities {
  return {
    echo: async (input: string) => input,
    checkDatabaseConnection: async () => {
      // Read-only, so route it to the replica (see AGENTS.md); this also makes the smoke test
      // prove that the worker's replica routing works, not just the primary connection.
      await globalPrismaClient.$replica().$queryRaw`SELECT 1`;
      return { ok: true };
    },
  } satisfies HexclaveActivities;
}
