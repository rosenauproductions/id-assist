"use client";

import type { CourseMode, Methodology, MethodologyPhase } from "@/lib/id/types";
import { labelFor, phasesFor } from "@/components/mode-indicator";

// Direct mode/phase switcher opened by ModeIndicator's secondary action
// (caret click, right-click, or long-press) — lets a user jump straight to
// a mode/phase without navigating to the Map tab first.

export function ModeSelector({
  methodology,
  onChange,
  onClose,
}: {
  methodology: Methodology;
  onChange: (next: Methodology) => void;
  onClose: () => void;
}) {
  const phases = phasesFor(methodology.mode);

  function pickMode(mode: CourseMode) {
    if (mode === methodology.mode) return;
    onChange({ mode, phase: phasesFor(mode)[0] });
  }

  function pickPhase(phase: MethodologyPhase) {
    if (phase === methodology.phase) {
      onClose();
      return;
    }
    onChange({ mode: methodology.mode, phase });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close mode selector"
        onClick={onClose}
        className="fixed inset-0 z-10 cursor-default"
      />
      <div
        role="menu"
        className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-line bg-card p-3 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Methodology
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="mt-2 flex gap-1 rounded-md border border-line p-1">
          {(["addie", "sam"] as CourseMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => pickMode(mode)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                methodology.mode === mode
                  ? "bg-line/60 text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "sam" ? "SAM" : "ADDIE"}
            </button>
          ))}
        </div>
        <ul className="mt-2 grid gap-0.5">
          {phases.map((phase) => (
            <li key={phase}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={methodology.phase === phase}
                onClick={() => pickPhase(phase)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  methodology.phase === phase
                    ? "bg-accent/10 text-accent"
                    : "hover:bg-line/30"
                }`}
              >
                {labelFor(methodology.mode, phase)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
