/**
 * Workflow ID helpers. All Hexclave workflow IDs are deterministic by construction so that
 * Temporal's workflow ID uniqueness doubles as dedup, and so that E2E snapshot serializers
 * (which already normalize UUIDs) handle them without extra rules.
 */

export type CarrierSubsystem =
  | "smoke-test";
// Subsystems are added here as their migrations land, e.g.:
// | "email-processor"
// | "db-sync"

/**
 * Per-tenancy carrier (entity) workflow ID. Carriers are lazily started via signalWithStart and
 * complete when idle, so this ID is reused across many workflow runs of the same carrier.
 */
export function getCarrierWorkflowId(subsystem: CarrierSubsystem, tenancyId: string): string {
  return `${subsystem}--${tenancyId}`;
}
