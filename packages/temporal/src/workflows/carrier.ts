import { condition, continueAsNew, setHandler, workflowInfo } from "@temporalio/workflow";
import { carrierWakeSignal } from "../contracts/signals";

export type CarrierBatchResult = {
  /** True if the batch pass left actionable work behind (i.e. another pass should run now). */
  remaining: boolean,
};

export type CarrierLoopOptions = {
  /**
   * Processes one batch of pending work (claim from DB → process → write results back). Must be
   * an activity call (or a composition of them) — no I/O in workflow code.
   */
  processOneBatch: () => Promise<CarrierBatchResult>,
  /**
   * How long to wait for new wake-up signals after the backlog is drained before completing the
   * workflow. Completion is cheap: the next enqueue's signalWithStart recreates the carrier.
   */
  idleTimeoutMs?: number,
  /**
   * Continue-As-New once the history grows past this many events, even if the server hasn't
   * suggested it yet. One batch pass costs roughly 5–10 events, so the default keeps carriers
   * far below Temporal's 50k hard limit.
   */
  maxHistoryLengthBeforeContinueAsNew?: number,
};

/**
 * The shared loop for per-tenancy carrier (entity) workflows.
 *
 * Contract with the rest of the system:
 * - Carriers are only ever started via signalWithStart (or Continue-As-New), so a fresh run
 *   always starts with one implicit wake-up and immediately processes a batch.
 * - Wake-up signals are counting hints with no payload; the batch activity re-reads pending
 *   work from Postgres. Signals that arrive *during* a batch pass are therefore not lost —
 *   they trigger one more pass, which either finds the work or comes back empty.
 * - Signals buffered by the server across a Continue-As-New boundary may not increment our
 *   counter, but that's fine for the same reason: the fresh run's implicit first pass re-reads
 *   the DB anyway.
 */
export async function runCarrierLoop(options: CarrierLoopOptions): Promise<void> {
  const idleTimeoutMs = options.idleTimeoutMs ?? 10 * 60 * 1000;
  const maxHistoryLength = options.maxHistoryLengthBeforeContinueAsNew ?? 10_000;

  // Starting (via signalWithStart or Continue-As-New) counts as one wake-up.
  let pendingWakeups = 1;
  setHandler(carrierWakeSignal, () => {
    pendingWakeups++;
  });

  while (true) {
    if (workflowInfo().continueAsNewSuggested || workflowInfo().historyLength > maxHistoryLength) {
      return await continueAsNew();
    }

    if (pendingWakeups === 0) {
      const wokeUp = await condition(() => pendingWakeups > 0, idleTimeoutMs);
      if (!wokeUp) {
        // Idle: complete. signalWithStart recreates the carrier when new work arrives, and the
        // subsystem's sweeper schedule covers rows whose post-commit signal was lost.
        return;
      }
    }

    pendingWakeups = 0;
    const result = await options.processOneBatch();
    if (result.remaining) {
      pendingWakeups++;
    }
  }
}
