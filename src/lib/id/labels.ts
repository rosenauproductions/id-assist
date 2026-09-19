import type { GagneEvent, TimePhase } from "./types";

/**
 * Plain-English label for each step of Gagné's Nine Events, shown instead
 * of the raw event name wherever a lesson's beat-by-beat structure is
 * displayed. The underlying value (unit.gagne) stays the Gagné term
 * everywhere else — this is display-only, so nothing downstream (compile,
 * filters, adapters) needs to change.
 */
export const GAGNE_LABELS: Record<GagneEvent, string> = {
  attention: "Hook",
  objectives: "What they'll learn",
  recall: "Refresher",
  present: "New info",
  guide: "Walkthrough",
  elicit: "Practice",
  feedback: "Feedback",
  assess: "Check",
  retain: "Wrap-up",
};

/** Display label for a time-log phase — mostly just capitalized, except
 * "qa" which needs the acronym capitalization a simple capitalize() would
 * miss. */
export const TIME_PHASE_LABELS: Record<TimePhase, string> = {
  analyze: "Analyze",
  design: "Design",
  develop: "Develop",
  review: "Review",
  build: "Build",
  qa: "QA",
};

/** Capitalizes the first letter only — for plain-word enum values (Bloom
 * levels, assessment formats) that just need to look like a label instead
 * of a raw lowercase database value. */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
