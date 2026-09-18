"use client";

import { useId, useRef } from "react";
import {
  ADDIE_PHASES,
  ADDIE_PHASE_LABELS,
  SAM_PHASES,
  SAM_PHASE_LABELS,
  type CourseMode,
  type MethodologyPhase,
} from "@/lib/id/types";

// Xbox-achievement-style segmented LED ring course-mode indicator (roadmap
// section 13 follow-up). ADDIE gets 5 sequential-looking segments (Analyze/
// Design/Develop/Implement/Evaluate); SAM gets 3 (Preparation/Iterative
// Design/Iterative Development) — SAM's active segment isn't drawn any
// differently for being non-sequential (that's a property of how it's set,
// in the selector this indicator opens, not how it's drawn). Only the
// current phase's segment glows; the rest sit dim on the ring. This is a
// visual restyle (glowing LED segments on a recessed plate, matching the
// Xbox achievement-ring reference) plus a phase-name label to the right
// of the ring — same underlying data/behavior as before.

const SIZE = 40;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const GAP_DEG = 14;
const LONG_PRESS_MS = 500;

export function phasesFor(mode: CourseMode): readonly MethodologyPhase[] {
  return mode === "sam" ? SAM_PHASES : ADDIE_PHASES;
}

export function labelFor(mode: CourseMode, phase: MethodologyPhase): string {
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
  const glowId = useId();

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
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex shrink-0 items-center">
        <button
          type="button"
          title={`${modeLabel} · ${phaseLabel} — open the map`}
          aria-label={`Course mode: ${modeLabel}, phase ${phaseLabel}. Click to open the map.`}
          onClick={onOpenMap}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          className="flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <defs>
              <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* recessed plate behind the ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={SIZE / 2 - 0.5}
              fill="var(--card)"
              stroke="var(--line)"
              strokeWidth={1}
            />
            {/* inner bezel line around the center "button" */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS - STROKE / 2 - 2.5}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1}
              opacity={0.6}
            />
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
                  opacity={isActive ? 1 : 0.5}
                  filter={isActive ? `url(#${glowId})` : undefined}
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
          className="absolute -right-1 -bottom-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted hover:text-foreground"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden>
            <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
          {modeLabel}
        </span>
        <span className="text-sm font-semibold text-foreground">{phaseLabel}</span>
      </span>
    </span>
  );
}
