import { Client, Connection } from "@temporalio/client";

// Helpers for asserting on Temporal state in E2E tests. As subsystems migrate to Temporal,
// tests that used to poll DB rows for async completion can instead (or additionally) wait for
// the corresponding workflow directly.

let clientPromise: Promise<Client> | undefined;

function getTemporalAddress(): string {
  const raw = process.env.HEXCLAVE_TEMPORAL_ADDRESS ?? "localhost:8146";
  // .env values use the ${NEXT_PUBLIC_HEXCLAVE_PORT_PREFIX:-81} placeholder that the backend's
  // polyfills expand at runtime; the e2e runner doesn't load those polyfills, so expand here.
  const prefix = process.env.NEXT_PUBLIC_HEXCLAVE_PORT_PREFIX ?? "81";
  return raw.replace(/\$\{NEXT_PUBLIC_HEXCLAVE_PORT_PREFIX:-81\}/g, prefix);
}

export async function getTemporalTestClient(): Promise<Client> {
  if (clientPromise == null) {
    clientPromise = (async () => {
      const connection = await Connection.connect({ address: getTemporalAddress() });
      return new Client({ connection, namespace: process.env.HEXCLAVE_TEMPORAL_NAMESPACE ?? "default" });
    })();
  }
  return await clientPromise;
}

/**
 * Waits for the given workflow's current run to complete and returns its result. Throws if the
 * workflow fails/times out — which is what a test usually wants.
 */
export async function waitForWorkflowCompletion<ResultT = unknown>(workflowId: string): Promise<ResultT> {
  const client = await getTemporalTestClient();
  const handle = client.workflow.getHandle(workflowId);
  return await handle.result() as ResultT;
}

/**
 * Lists workflow executions whose IDs start with the given prefix (e.g. a carrier subsystem
 * prefix like `email-processor--`). Useful for asserting dedup invariants ("exactly one running
 * carrier per tenancy").
 */
export async function listWorkflowsByIdPrefix(workflowIdPrefix: string, options?: { onlyRunning?: boolean }): Promise<{ workflowId: string, status: string }[]> {
  const client = await getTemporalTestClient();
  const results: { workflowId: string, status: string }[] = [];
  const statusFilter = options?.onlyRunning ? ` AND ExecutionStatus = 'Running'` : "";
  const query = `WorkflowId STARTS_WITH '${workflowIdPrefix.replace(/'/g, "''")}'${statusFilter}`;
  for await (const workflow of client.workflow.list({ query })) {
    results.push({ workflowId: workflow.workflowId, status: workflow.status.name });
  }
  return results;
}

/**
 * Triggers a Temporal Schedule to run immediately (instead of waiting for its next tick) —
 * the replacement for the old pattern of POSTing to CRON_SECRET-protected internal endpoints.
 */
export async function triggerScheduleNow(scheduleId: string): Promise<void> {
  const client = await getTemporalTestClient();
  await client.schedule.getHandle(scheduleId).trigger();
}
