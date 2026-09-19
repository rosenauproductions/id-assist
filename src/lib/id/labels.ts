import type { FilterSeverity, GagneEvent, Outcome, TimePhase } from "./types";

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

/** Plain-English label for an objective's kind, shown on its card instead
 * of the raw "terminal"/"enabling" instructional-design term. The
 * professional term stays available as a hover title where this label is
 * used, same pattern as the filter-code tooltip elsewhere in this file's
 * screen — the underlying value (outcome.kind) is untouched everywhere
 * else (compile, filters, requirements). */
export const OUTCOME_KIND_LABELS: Record<Outcome["kind"], string> = {
  terminal: "Main objective",
  enabling: "Supporting objective",
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

/** Plain-English label for a Quality-check finding's severity, shown on
 * its card instead of the raw internal tier name. "pass" hits are always
 * marked resolved internally (so they don’t count toward the open-issue
 * total) even though nothing was ever wrong — the Quality checks list
 * hides the "resolved" suffix for "pass" rows for that reason; see
 * FilterRow in project-workspace.tsx. */
export const SEVERITY_LABELS: Record<FilterSeverity, string> = {
  pass: "Looks good",
  rewrite: "Needs work",
  split: "Needs splitting",
  block: "Blocking",
};

/** Capitalizes the first letter only — for plain-word enum values (Bloom
 * levels, assessment formats) that just need to look like a label instead
 * of a raw lowercase database value. */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
