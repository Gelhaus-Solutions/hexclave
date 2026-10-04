"use client";

import { Button } from "@/components/ui";
import {
  readReplayChoice,
  recordingConfigured,
  reopenReplayChoice,
  REPLAY_CONSENT_EVENT,
  saveReplayChoice,
  type ReplayChoice,
} from "@/lib/replay-consent";
import { runAsynchronously } from "@hexclave/shared/dist/utils/promises";
import { useEffect, useState } from "react";

const PRIVACY_URL = "https://gplatform.org/datenschutz";

/**
 * The question that has to be answered before a visit is recorded.
 *
 * Shown once, at the foot of whatever page somebody lands on, and again when
 * they pick "Session recording" in the footer or their account menu. Both
 * answers are buttons of the same weight: saying no must be as easy as saying
 * yes, and leaving the bar unanswered records nothing. Nothing is shown where
 * no recorder is configured, since there is then nothing to record.
 */
export function ReplayConsent() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ReplayChoice | null>(null);

  useEffect(() => {
    if (!recordingConfigured()) return;
    const stored = readReplayChoice();
    setCurrent(stored);
    if (stored === null) setOpen(true);
    const reopen = () => {
      setCurrent(readReplayChoice());
      setOpen(true);
    };
    window.addEventListener(REPLAY_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(REPLAY_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: ReplayChoice) => {
    runAsynchronously(saveReplayChoice(choice));
    setCurrent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Session recording"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          May we record this visit to find and fix errors? The recording shows the pages as you see
          them, including what you type, and goes to the error-tracking service named in the privacy
          notice. Nothing is recorded unless you allow it, and you can change your mind under
          &ldquo;Session recording&rdquo; at any time.
          {current === null ? null : ` Currently ${current === "granted" ? "allowed" : "not allowed"}.`}{" "}
          <a href={PRIVACY_URL} className="underline underline-offset-2">
            Privacy notice
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>
            Don&apos;t record
          </Button>
          <Button variant="outline" size="sm" onClick={() => choose("granted")}>
            Allow recording
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "Session recording" for places that are not a menu, such as the footer. */
export function ReplayChoiceLink({ children }: { children: React.ReactNode }) {
  if (!recordingConfigured()) return null;
  return (
    <button type="button" className="bg-transparent p-0" onClick={reopenReplayChoice}>
      {children}
    </button>
  );
}
