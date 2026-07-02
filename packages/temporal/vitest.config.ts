import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      // @temporalio/worker loads a native module (core-bridge) that is not compatible with
      // vitest's worker_threads pool, so run tests in forked processes instead.
      pool: 'forks',
      // The time-skipping test server needs a moment to download on first run.
      testTimeout: 120_000,
    },
  }),
);
