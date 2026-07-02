import { getEnvVariable, getNodeEnvironment } from "@hexclave/shared/dist/utils/env";
import { sentryBaseConfig } from "@hexclave/shared/dist/utils/sentry";
import * as Sentry from "@sentry/node";

// Mirrors the gating in apps/backend/src/instrumentation.ts: Sentry is only enabled outside
// development and CI. captureError from @hexclave/shared routes through the error sink that
// ensurePolyfilled() registers, which shares the global Sentry carrier with this init.
export function initSentry(): void {
  Sentry.init({
    ...sentryBaseConfig,
    dsn: getEnvVariable("NEXT_PUBLIC_SENTRY_DSN", ""),
    enabled: getNodeEnvironment() !== "development" && getEnvVariable("CI", "") === "",
  });
}
