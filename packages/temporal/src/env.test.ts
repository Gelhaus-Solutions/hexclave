import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getTemporalConnectionEnvConfig } from "./env";

const ENV_KEYS = [
  "HEXCLAVE_TEMPORAL_ADDRESS",
  "HEXCLAVE_TEMPORAL_NAMESPACE",
  "HEXCLAVE_TEMPORAL_TLS_CERT_PATH",
  "HEXCLAVE_TEMPORAL_TLS_KEY_PATH",
  "HEXCLAVE_TEMPORAL_TLS_SERVER_CA_PATH",
  "HEXCLAVE_TEMPORAL_TLS_SERVER_NAME_OVERRIDE",
] as const;

const originalEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originalEnv.get(key);
    if (original == null) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

describe("getTemporalConnectionEnvConfig", () => {
  it("returns a plaintext config when no TLS paths are set", () => {
    setEnv({ HEXCLAVE_TEMPORAL_ADDRESS: "localhost:8146" });
    const config = getTemporalConnectionEnvConfig();
    expect(config).toEqual({
      address: "localhost:8146",
      namespace: "default",
      tls: undefined,
    });
  });

  it("respects the namespace env var", () => {
    setEnv({ HEXCLAVE_TEMPORAL_ADDRESS: "localhost:8146", HEXCLAVE_TEMPORAL_NAMESPACE: "hexclave-prod" });
    expect(getTemporalConnectionEnvConfig().namespace).toBe("hexclave-prod");
  });

  it("throws when only one of cert/key path is set", () => {
    setEnv({ HEXCLAVE_TEMPORAL_ADDRESS: "localhost:8146", HEXCLAVE_TEMPORAL_TLS_CERT_PATH: "/tmp/cert.pem" });
    expect(() => getTemporalConnectionEnvConfig()).toThrowError(/must either both be set/);
  });

  it("throws when CA/server-name-override are set without cert/key", () => {
    setEnv({ HEXCLAVE_TEMPORAL_ADDRESS: "localhost:8146", HEXCLAVE_TEMPORAL_TLS_SERVER_CA_PATH: "/tmp/ca.pem" });
    expect(() => getTemporalConnectionEnvConfig()).toThrowError(/mTLS is disabled/);
  });

  it("reads cert material from the configured file paths", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexclave-temporal-env-test-"));
    try {
      const certPath = path.join(dir, "client.pem");
      const keyPath = path.join(dir, "client.key");
      const caPath = path.join(dir, "ca.pem");
      fs.writeFileSync(certPath, "FAKE CERT");
      fs.writeFileSync(keyPath, "FAKE KEY");
      fs.writeFileSync(caPath, "FAKE CA");
      setEnv({
        HEXCLAVE_TEMPORAL_ADDRESS: "10.0.0.5:7233",
        HEXCLAVE_TEMPORAL_TLS_CERT_PATH: certPath,
        HEXCLAVE_TEMPORAL_TLS_KEY_PATH: keyPath,
        HEXCLAVE_TEMPORAL_TLS_SERVER_CA_PATH: caPath,
        HEXCLAVE_TEMPORAL_TLS_SERVER_NAME_OVERRIDE: "temporal.internal",
      });
      const config = getTemporalConnectionEnvConfig();
      expect(config.tls?.clientCertPair?.crt.toString()).toBe("FAKE CERT");
      expect(config.tls?.clientCertPair?.key.toString()).toBe("FAKE KEY");
      expect(config.tls?.serverRootCACertificate?.toString()).toBe("FAKE CA");
      expect(config.tls?.serverNameOverride).toBe("temporal.internal");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
