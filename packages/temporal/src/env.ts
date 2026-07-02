import { getEnvVariable } from "@hexclave/shared/dist/utils/env";
import { throwErr } from "@hexclave/shared/dist/utils/errors";
import type { TLSConfig } from "@temporalio/client";
import fs from "node:fs";

export type TemporalConnectionEnvConfig = {
  address: string,
  namespace: string,
  tls: TLSConfig | undefined,
};

/**
 * Reads the Temporal connection configuration from the environment.
 *
 * TLS (mTLS towards a self-hosted Temporal cluster) is enabled iff both the client cert and key
 * paths are set. The CA path and the server name override are optional extras on top of that
 * (the server name override is needed when connecting to the cluster by raw IP with a
 * self-signed CA, because SNI/hostname verification would otherwise fail).
 *
 * The cert files are read eagerly here (rather than lazily at connect time) so that a
 * misconfigured deployment fails at startup instead of on the first workflow interaction.
 */
export function getTemporalConnectionEnvConfig(): TemporalConnectionEnvConfig {
  const address = getEnvVariable("HEXCLAVE_TEMPORAL_ADDRESS");
  const namespace = getEnvVariable("HEXCLAVE_TEMPORAL_NAMESPACE", "default");

  const certPath = getEnvVariable("HEXCLAVE_TEMPORAL_TLS_CERT_PATH", "");
  const keyPath = getEnvVariable("HEXCLAVE_TEMPORAL_TLS_KEY_PATH", "");
  const serverCaPath = getEnvVariable("HEXCLAVE_TEMPORAL_TLS_SERVER_CA_PATH", "");
  const serverNameOverride = getEnvVariable("HEXCLAVE_TEMPORAL_TLS_SERVER_NAME_OVERRIDE", "");

  if ((certPath === "") !== (keyPath === "")) {
    throwErr("HEXCLAVE_TEMPORAL_TLS_CERT_PATH and HEXCLAVE_TEMPORAL_TLS_KEY_PATH must either both be set (mTLS enabled) or both be unset (plaintext, dev only). Only one of them is currently set.");
  }
  if (certPath === "" && (serverCaPath !== "" || serverNameOverride !== "")) {
    throwErr("HEXCLAVE_TEMPORAL_TLS_SERVER_CA_PATH/HEXCLAVE_TEMPORAL_TLS_SERVER_NAME_OVERRIDE are set, but mTLS is disabled because HEXCLAVE_TEMPORAL_TLS_CERT_PATH/HEXCLAVE_TEMPORAL_TLS_KEY_PATH are not set.");
  }

  let tls: TLSConfig | undefined;
  if (certPath !== "") {
    tls = {
      clientCertPair: {
        crt: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      },
      ...serverCaPath !== "" ? { serverRootCACertificate: fs.readFileSync(serverCaPath) } : {},
      ...serverNameOverride !== "" ? { serverNameOverride } : {},
    };
  }

  return { address, namespace, tls };
}
