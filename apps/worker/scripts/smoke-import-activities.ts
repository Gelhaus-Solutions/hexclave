// Smoke test for the worker↔backend seam: imports the curated activities barrel under plain
// Node (tsx), which fails loudly if anything in the barrel's transitive import graph pulls in
// Next.js-only modules (next/headers, server-only, route-handler context, ...). Run via
// `pnpm -C apps/worker smoke-import-activities`; also intended for CI.

import "../src/claim-shutdown-ownership";

async function main(): Promise<void> {
  const barrel = await import("@hexclave/backend/temporal-activities");
  barrel.ensurePolyfilled();
  const activities = barrel.createBackendTemporalActivities();
  const activityNames = Object.keys(activities);
  if (activityNames.length === 0) {
    throw new Error("createBackendTemporalActivities() returned no activities — the barrel is broken.");
  }
  console.log(`OK: activities barrel imported under plain Node, ${activityNames.length} activities registered (${activityNames.join(", ")}).`);
  // The import graph of the barrel may have opened DB pools etc.; this is a smoke script, so
  // just exit successfully instead of trying to unwind them.
  process.exit(0);
}

await main();
