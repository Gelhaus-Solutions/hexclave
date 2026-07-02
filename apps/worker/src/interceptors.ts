import { captureError } from "@hexclave/shared/dist/utils/errors";
import type { ActivityInterceptorsFactory } from "@temporalio/worker";

/**
 * Reports activity failures to Sentry (via captureError) without interfering with Temporal's
 * own retry handling — the error is rethrown so the activity still fails/retries normally.
 * Note that this fires on every failed attempt, not just the final one; that's intentional, as
 * transiently failing activities are worth seeing in Sentry too.
 */
export const sentryActivityInterceptorFactory: ActivityInterceptorsFactory = (ctx) => ({
  inbound: {
    async execute(input, next) {
      try {
        return await next(input);
      } catch (error) {
        captureError(`temporal-activity:${ctx.info.activityType}`, error);
        throw error;
      }
    },
  },
});
