import { getPublicEnvVar } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

/**
 * Session recording runs only for a visitor who has said yes.
 *
 * Recording a visit, and keeping the recorder's session id in the browser, is
 * access to the visitor's device (Section 25 TDDDG, Art. 5(3) ePrivacy
 * Directive), and finding our own bugs is not something the visitor asked for,
 * so it needs consent (the operator's decision, 2026-10-04). Two recorders can
 * be configured: Sentry's replay, with NEXT_PUBLIC_SENTRY_DSN, and PostHog,
 * with NEXT_PUBLIC_POSTHOG_KEY. Neither starts before a yes, and without
 * either nothing is asked.
 *
 * PostHog runs only with a key of our own. Upstream fell back to Stack Auth's
 * own project key, which sent every dashboard visit, typed text included, to
 * their PostHog project.
 *
 * The choice itself is kept in local storage. Remembering a "no" is what stops
 * the question coming back on every page, which makes storing it strictly
 * necessary rather than another thing to ask about.
 */

export const REPLAY_CONSENT_KEY = "hexclave.replay-consent";

/** Fired on window to show the question again (the "Session recording" entries). */
export const REPLAY_CONSENT_EVENT = "hexclave:replay-consent";

export type ReplayChoice = "granted" | "denied";

/**
 * The replay half of Sentry's SDK, which only its browser build has. Under
 * Node (the unit tests, a server import) `getReplay` and `replayIntegration`
 * are simply absent.
 */
const browser = Sentry as Partial<Pick<typeof Sentry, "getReplay" | "replayIntegration">>;

/** Whether anything here can record a visit, and so whether to ask at all. */
export function recordingConfigured(): boolean {
  return Boolean(getPublicEnvVar("NEXT_PUBLIC_SENTRY_DSN")) || Boolean(posthogKey());
}

/** The stored choice, or null when none was made or storage is unavailable. */
export function readReplayChoice(storage: Storage | undefined = safeLocalStorage()): ReplayChoice | null {
  try {
    const value = storage?.getItem(REPLAY_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Store the choice and act on it at once: a yes starts recording from this
 * page, a no stops a recording that is running.
 */
export async function saveReplayChoice(
  choice: ReplayChoice,
  storage: Storage | undefined = safeLocalStorage(),
): Promise<void> {
  try {
    storage?.setItem(REPLAY_CONSENT_KEY, choice);
  } catch {
    // Private mode or a full quota: the choice still applies to this page.
  }
  if (choice === "granted") startReplay();
  else await stopReplay();
}

/** Start whichever recorders are configured, adding Sentry's the first time. */
export function startReplay(): void {
  if (Sentry.getClient() && browser.getReplay && browser.replayIntegration) {
    const replay = browser.getReplay();
    if (replay) replay.start();
    else {
      Sentry.addIntegration(
        browser.replayIntegration({
          maskAllText: false,
          maskAllInputs: false,
          blockAllMedia: false,
        }),
      );
    }
  }
  const key = posthogKey();
  if (key === undefined || typeof window === "undefined") return;
  if (!posthog.__loaded) {
    posthog.init(key, {
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
      defaults: "2025-11-30",
      api_host: "/consume",
      ui_host: "https://eu.i.posthog.com",
    });
    return;
  }
  posthog.opt_in_capturing();
  posthog.startSessionRecording();
}

export async function stopReplay(): Promise<void> {
  await browser.getReplay?.()?.stop();
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.stopSessionRecording();
    posthog.opt_out_capturing();
  }
}

/** Show the question again, with the current choice said in the text. */
export function reopenReplayChoice(): void {
  window.dispatchEvent(new Event(REPLAY_CONSENT_EVENT));
}

function posthogKey(): string | undefined {
  const key = getPublicEnvVar("NEXT_PUBLIC_POSTHOG_KEY");
  return key !== undefined && key.length > 5 ? key : undefined;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
