// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { getPublicEnvVar } from "@/lib/env";
import { readReplayChoice, startReplay } from "@/lib/replay-consent";
import * as Sentry from "@sentry/nextjs";
import { getBrowserCompatibilityReport } from "@hexclave/shared/dist/utils/browser-compat";
import { sentryBaseConfig } from "@hexclave/shared/dist/utils/sentry";
import { nicify } from "@hexclave/shared/dist/utils/strings";
import posthog from "posthog-js";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// PostHog records sessions, so it starts only with a key of our own and only
// for a visitor who allowed recording: startReplay() below initialises it.
// Upstream fell back to Stack Auth's own project key here.
const postHogKey = getPublicEnvVar('NEXT_PUBLIC_POSTHOG_KEY');


Sentry.init({
  ...sentryBaseConfig,

  dsn: getPublicEnvVar('NEXT_PUBLIC_SENTRY_DSN'),

  enabled: process.env.NODE_ENV !== "development" && !process.env.CI,

  // No replay here: startReplay() below adds it, and only for a visitor who
  // allowed recording (lib/replay-consent.ts). The session sample rates in
  // sentryBaseConfig apply once it is added.
  integrations: postHogKey !== undefined && postHogKey.length > 5 ? [
    posthog.sentryIntegration({
      organization: "stackframe-pw",
      projectId: 4507084192219136,
    }),
  ] : [],

  // Add exception metadata to the event
  beforeSend(event, hint) {
    const error = hint.originalException;
    let nicified;
    try {
      nicified = nicify(error, { maxDepth: 8 });
    } catch (e) {
      nicified = `Error occurred during nicification: ${e}`;
    }
    if (error instanceof Error) {
      event.extra = {
        ...event.extra,
        cause: error.cause,
        errorProps: {
          ...error,
        },
        nicifiedError: nicified,
        clientBrowserCompatibility: getBrowserCompatibilityReport(),
      };
    }
    return event;
  },
});

// A yes given on an earlier page or visit. A first-time visitor is asked by
// <ReplayConsent> in the root layout, and nothing is recorded until they answer.
if (readReplayChoice() === "granted") startReplay();
