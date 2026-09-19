import { nid } from "./ids";
import { runFilters } from "./filters";
import {
  COURSE_PHASES,
  type CoursePhase,
  type IdProject,
  type PhaseStatus,
  type RequirementItem,
  type RequirementPriority,
} from "./types";

type AutoRequirement = Omit<RequirementItem, "id" | "source" | "createdAt">;

function auto(
  phase: CoursePhase,
  autoCode: string,
  label: string,
  priority: RequirementPriority,
  done: boolean,
): AutoRequirement {
  return { phase, autoCode, label, priority, done };
}

/**
 * Derives the "live" auto-checked requirements from the project's current
 * state. Pure function — safe to call any time the outline changes.
 * Deliberately doesn't know about manually-added items; mergeRequirements()
 * layers those back in on top of this.
 */
export function deriveRequirements(project: IdProject): AutoRequirement[] {
  const { outline } = project;
  const filters = outline.filters.length ? outline.filters : runFilters(outline);
  const open = (code: string) =>
    filters.some(
      (filter) =>
        filter.code === code && !filter.resolved && filter.severity !== "pass",
    );

  const items: AutoRequirement[] = [];

  // Discovery
  items.push(
    auto(
      "discovery",
      "brief.title",
      "Course has a working title",
      "required",
      !!outline.brief.title.trim(),
    ),
    auto(
      "discovery",
      "brief.audience",
      "Audience is defined",
      "required",
      !!outline.brief.audience.trim(),
    ),
    auto(
      "discovery",
      "brief.job_task",
      "Job/task the course targets is defined",
      "required",
      !!outline.brief.jobTask.trim(),
    ),
    auto(
      "discovery",
      "andragogy.why_now",
      "Why-now (workplace relevance) is documented",
      "required",
      !open("andragogy.why_now"),
    ),
    auto(
      "discovery",
      "duration.missing",
      "Seat-time budget is set",
      "required",
      !open("duration.missing"),
    ),
  );

  // Design
  const hasTerminal = outline.outcomes.some((outcome) => outcome.kind === "terminal");
  const hasEnabling = outline.outcomes.some((outcome) => outcome.kind === "enabling");
  items.push(
    auto(
      "design",
      "design.terminal_outcome",
      "At least one terminal outcome is defined",
      "required",
      hasTerminal,
    ),
    auto(
      "design",
      "design.enabling_outcome",
      "Smaller objectives build toward the course's main objective",
      "recommended",
      hasEnabling,
    ),
    auto(
      "design",
      "objective.quality",
      "Every objective is something you can actually measure",
      "required",
      !open("objective.quality"),
    ),
    auto(
      "design",
      "outcome.uncovered",
      "Every objective has a lesson teaching it",
      "required",
      !open("outcome.uncovered"),
    ),
  );

  // Content development
  items.push(
    auto(
      "content_development",
      "chunk.size",
      "Lessons are within the 5–12 min chunk range",
      "recommended",
      !open("chunk.size"),
    ),
    auto(
      "content_development",
      "rise.blocks",
      "Rise lessons have 3–8 blocks",
      "recommended",
      !open("rise.blocks"),
    ),
    auto(
      "content_development",
      "delivery.mismatch",
      "How each lesson is delivered matches how hard its objective is",
      "recommended",
      !open("delivery.mismatch"),
    ),
    auto(
      "content_development",
      "objective.no_activity",
      "Every objective's lesson includes a chance to practice",
      "required",
      !open("objective.no_activity"),
    ),
    auto(
      "content_development",
      "module.objective_gap",
      "Every module's objectives are matched by a practice activity",
      "required",
      !open("module.objective_gap"),
    ),
  );

  // Assessment
  items.push(
    auto(
      "assessment",
      "coverage.missing",
      "Every terminal outcome has an assessment spec",
      "required",
      !open("coverage.missing"),
    ),
    auto(
      "assessment",
      "alignment.bloom",
      "Each test matches how hard its objective is",
      "required",
      !open("alignment.bloom"),
    ),
    auto(
      "assessment",
      "tutor.evidence",
      "Harder objectives aren't proven by chat alone",
      "required",
      !open("tutor.evidence"),
    ),
    auto(
      "assessment",
      "coverage.no_artifact_channel",
      "Harder objectives have real proof selected, not just chat",
      "required",
      !open("coverage.no_artifact_channel"),
    ),
    auto(
      "assessment",
      "assessment.item_count_gap",
      "Assessment item counts meet the stated requirement",
      "recommended",
      !open("assessment.item_count_gap"),
    ),
  );

  // Review
  const openBlocking = filters.some(
    (filter) => filter.severity === "block" && !filter.resolved,
  );
  items.push(
    auto(
      "review",
      "review.no_open_blocks",
      "No blocking issues are left open",
      "required",
      !openBlocking,
    ),
    auto(
      "review",
      "review.approved",
      "Outline has been approved",
      "required",
      outline.status === "approved",
    ),
  );

  // QA
  items.push(
    auto(
      "qa",
      "qa.duration_budget",
      "Total seat time is within the duration budget",
      "required",
      !open("duration.over"),
    ),
  );

  // Assembly
  items.push(
    auto(
      "assembly",
      "assembly.artifacts",
      "Delivery files have been generated",
      "required",
      project.artifacts.length > 0,
    ),
  );

  // Publishing — nothing auto-checkable yet; there's no real publish/export
  // destination to verify against, so this phase is manual-items-only until
  // one exists.

  return items;
}

/**
 * Combines fresh auto-derived items with whatever manual items and manual
 * `done` states already existed. Auto items are matched by `autoCode` and
 * always take their `done` value from the fresh derivation — they reflect
 * live outline state, not something a person checks off. Manual items pass
 * through untouched (including their `done` state and id).
 */
export function mergeRequirements(
  existing: RequirementItem[],
  project: IdProject,
): RequirementItem[] {
  const derived = deriveRequirements(project);
  const manual = existing.filter((item) => item.source === "manual");
  const now = new Date().toISOString();
  const refreshedAuto: RequirementItem[] = derived.map((item) => {
    const prior = existing.find(
      (candidate) =>
        candidate.source === "auto" && candidate.autoCode === item.autoCode,
    );
    return {
      id: prior?.id ?? nid("req"),
      source: "auto",
      createdAt: prior?.createdAt ?? now,
      ...item,
    };
  });
  return [...refreshedAuto, ...manual];
}

type PhaseStats = {
  total: number;
  done: number;
  requiredTotal: number;
  requiredDone: number;
  percent: number;
};

export function phaseCompletion(
  requirements: RequirementItem[],
): Record<CoursePhase, PhaseStats> {
  const stats = Object.fromEntries(
    COURSE_PHASES.map((phase) => [
      phase,
      { total: 0, done: 0, requiredTotal: 0, requiredDone: 0, percent: 0 },
    ]),
  ) as Record<CoursePhase, PhaseStats>;

  for (const item of requirements) {
    const bucket = stats[item.phase];
    if (!bucket) continue;
    bucket.total += 1;
    if (item.done) bucket.done += 1;
    if (item.priority === "required") {
      bucket.requiredTotal += 1;
      if (item.done) bucket.requiredDone += 1;
    }
  }

  for (const phase of COURSE_PHASES) {
    const bucket = stats[phase];
    bucket.percent =
      bucket.total === 0 ? 0 : Math.round((bucket.done / bucket.total) * 100);
  }

  return stats;
}

export type EffectivePhase = {
  phase: CoursePhase;
  percent: number;
  status: PhaseStatus;
  overridden: boolean;
  requiredTotal: number;
  requiredDone: number;
};

function autoStatus(
  percent: number,
  requiredTotal: number,
  requiredDone: number,
): PhaseStatus {
  if (requiredTotal > 0 && requiredDone < requiredTotal && percent >= 100) {
    return "in_progress";
  }
  if (percent >= 100) return "done";
  if (percent > 0) return "in_progress";
  return "not_started";
}

/**
 * The timeline's actual per-phase view: auto-calculated percent from the
 * checklist, with a manual override (percent and/or status) laid on top
 * when one exists in `project.phaseProgress`.
 */
export function effectivePhaseProgress(project: IdProject): EffectivePhase[] {
  const completion = phaseCompletion(project.requirements ?? []);
  const overrides = new Map(
    (project.phaseProgress ?? []).map((entry) => [entry.phase, entry]),
  );
  return COURSE_PHASES.map((phase) => {
    const stats = completion[phase];
    const override = overrides.get(phase);
    const percent = override?.manualPercent ?? stats.percent;
    const status =
      override?.manualStatus ??
      autoStatus(stats.percent, stats.requiredTotal, stats.requiredDone);
    return {
      phase,
      percent,
      status,
      overridden:
        override?.manualPercent !== undefined ||
        override?.manualStatus !== undefined,
      requiredTotal: stats.requiredTotal,
      requiredDone: stats.requiredDone,
    };
  });
}
