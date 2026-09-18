"use client";

import { useRef } from "react";
import {
  ADDIE_PHASES,
  ADDIE_PHASE_LABELS,
  SAM_PHASES,
  SAM_PHASE_LABELS,
  type CourseMode,
  type MethodologyPhase,
} from "@/lib/id/types";

// Xbox-style segmented ring course-mode indicator (roadmap section 13
// follow-up). ADDIE gets 5 sequential-looking segments (Analyze/Design/
// Develop/Implement/Evaluate); SAM gets 3 (Preparation/Iterative Design/
// Iterative Development) — SAM's active segment isn't drawn any
// differently for being non-sequential (that's a property of how it's
// set, in the selector this indicator opens, not how it's drawn).

const SIZE = 28;
const STROKE = 3.5;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const GAP_DEG = 10;
const LONG_PRESS_MS = 500;

function phasesFor(mode: CourseMode): readonly MethodologyPhase[] {
  return mode === "sam" ? SAM_PHASES : ADDIE_PHASES;
}

function labelFor(mode: CourseMode, phase: MethodologyPhase): string {
  if (mode === "sam") {
    return SAM_PHASE_LABELS[phase as (typeof SAM_PHASES)[number]] ?? phase;
  }
  return ADDIE_PHASE_LABELS[phase as (typeof ADDIE_PHASES)[number]] ?? phase;
}

// angleDeg: 0 = top (12 o'clock), increasing clockwise.
function polarToCartesian(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.sin(rad),
    y: CENTER - RADIUS * Math.cos(rad),
  };
}

function describeSegment(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function ModeIndicator({
  mode,
  phase,
  onOpenMap,
  onOpenSelector,
  className = "",
}: {
  mode: CourseMode;
  phase: MethodologyPhase;
  /** Primary action: open the Map tab on its context-aware default view. */
  onOpenMap?: () => void;
  /** Secondary action: caret click, right-click, or long-press open a
   * mode/phase selector directly, without navigating. */
  onOpenSelector?: () => void;
  className?: string;
}) {
  const phases = phasesFor(mode);
  const n = phases.length;
  const segAngle = 360 / n;
  const activeIndex = phases.indexOf(phase);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    onOpenSelector?.();
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchStart() {
    clearLongPress();
    longPressTimer.current = setTimeout(() => onOpenSelector?.(), LONG_PRESS_MS);
  }

  const modeLabel = mode === "sam" ? "SAM" : "ADDIE";
  const phaseLabel = labelFor(mode, phase);

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        title={`${modeLabel} · ${phaseLabel} — open the map`}
        aria-label={`Course mode: ${modeLabel}, phase ${phaseLabel}. Click to open the map.`}
        onClick={onOpenMap}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80"
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {phases.map((segmentPhase, index) => {
            const start = index * segAngle + GAP_DEG / 2;
            const end = (index + 1) * segAngle - GAP_DEG / 2;
            const isActive = index === activeIndex;
            return (
              <path
                key={segmentPhase}
                d={describeSegment(start, end)}
                fill="none"
                stroke={isActive ? "var(--accent)" : "var(--line)"}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </button>
      <button
        type="button"
        title="Switch mode or phase"
        aria-label="Open mode and phase selector"
        onClick={(event) => {
          event.stopPropagation();
          onOpenSelector?.();
        }}
        className="flex h-5 w-4 shrink-0 items-center justify-center text-muted hover:text-foreground"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </span>
  );
}
