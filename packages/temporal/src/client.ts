import { globalVar } from "@hexclave/shared/dist/utils/globals";
import { Client, Connection } from "@temporalio/client";
import { getTemporalConnectionEnvConfig } from "./env";

type TemporalClientStore = {
  clientPromise: Promise<Client> | undefined,
};

// Cached on globalVar (like the Prisma client stores in apps/backend/src/prisma-client.tsx) so
// that hot-reloading in dev doesn't accumulate one gRPC connection per reload.
const clientStore: TemporalClientStore = globalVar.__hexclave_temporal_client_store ??= { clientPromise: undefined };

async function createTemporalClient(): Promise<Client> {
  const config = getTemporalConnectionEnvConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });
  return new Client({
    connection,
    namespace: config.namespace,
  });
}

/**
 * Returns the lazily created, process-wide Temporal client.
 *
 * If the initial connection fails, the failure is not cached — the next caller triggers a fresh
 * connection attempt, so a transient Temporal outage at boot doesn't permanently poison the
 * process.
 */
export async function getTemporalClient(): Promise<Client> {
  if (clientStore.clientPromise == null) {
    const clientPromise = createTemporalClient();
    clientStore.clientPromise = clientPromise;
    try {
      return await clientPromise;
    } catch (error) {
      if (clientStore.clientPromise === clientPromise) {
        clientStore.clientPromise = undefined;
      }
      throw error;
    }
  }
  return await clientStore.clientPromise;
}
