import { ASSESSMENT_FORMAT_LABELS, OUTCOME_KIND_LABELS, capitalizeFirst } from "./labels";
import type { CourseOutline, FilterHit } from "./types";

// The Alignment view answers one question per objective: does it have the
// instruction, practice, and assessment it needs? It's a pure
// visualization over the FilterHit data runFilters() (filters.ts) already
// computes — no new pass/fail judgment gets invented here, only the
// relational lookups (which lesson, which assessment) needed to draw the
// chain. See the roadmap's Map-redesign notes for why this stays a
// separate view from Quality checks rather than a second copy of it.

export type AlignmentStageStatus =
  | "ok"
  | "warning"
  | "missing"
  | "accepted"
  | "not_applicable";

export type AlignmentStage = {
  status: AlignmentStageStatus;
  label: string;
  detail?: string;
};

export type AlignmentLessonRef = { id: string; title: string };
export type AlignmentAssessmentRef = { id: string; label: string };

export type AlignmentRow = {
  outcomeId: string;
  kindLabel: string;
  bloom: string;
  headline: string;
  tooltip: string;
  lessons: AlignmentLessonRef[];
  lessonStage: AlignmentStage;
  practiceStage: AlignmentStage;
  assessment?: AlignmentAssessmentRef;
  assessmentStage: AlignmentStage;
};

function findHit(
  filters: FilterHit[],
  targetId: string,
  code: string,
): FilterHit | undefined {
  return filters.find((filter) => filter.targetId === targetId && filter.code === code);
}

export function buildAlignmentMap(outline: CourseOutline): AlignmentRow[] {
  return outline.outcomes.map((outcome) => {
    const lessons = outline.lessons.filter((lesson) =>
      lesson.objectiveIds.includes(outcome.id),
    );
    const assessment = outline.assessments.find(
      (candidate) => candidate.outcomeId === outcome.id,
    );

    const uncovered = findHit(outline.filters, outcome.id, "outcome.uncovered");
    const lessonStage: AlignmentStage =
      lessons.length > 0
        ? { status: "ok", label: "Taught" }
        : {
            status: "missing",
            label: "No lesson yet",
            detail: uncovered?.message,
          };

    const noActivity = findHit(outline.filters, outcome.id, "objective.no_activity");
    const practiceStage: AlignmentStage =
      lessons.length === 0
        ? { status: "not_applicable", label: "—" }
        : noActivity
          ? {
              status: noActivity.resolved ? "accepted" : "warning",
              label: noActivity.resolved ? "Practice waived" : "No practice yet",
              detail: noActivity.resolved ? noActivity.dismissReason : noActivity.message,
            }
          : { status: "ok", label: "Practiced" };

    const missingAssessment = findHit(outline.filters, outcome.id, "coverage.missing");
    const bloomMismatch = findHit(outline.filters, outcome.id, "alignment.bloom");

    let assessmentStage: AlignmentStage;
    if (assessment) {
      assessmentStage = bloomMismatch
        ? {
            status: bloomMismatch.resolved ? "accepted" : "warning",
            label: bloomMismatch.resolved ? "Level mismatch accepted" : "Bloom level mismatch",
            detail: bloomMismatch.resolved
              ? bloomMismatch.dismissReason
              : bloomMismatch.message,
          }
        : { status: "ok", label: "Proven" };
    } else if (missingAssessment) {
      assessmentStage = {
        status: "missing",
        label: "No assessment yet",
        detail: missingAssessment.message,
      };
    } else {
      // Supporting objectives aren't required to carry their own
      // assessment — filters.ts only runs the coverage checks for main
      // objectives — so a supporting objective with no assessment here is
      // a neutral fact, not a flagged issue.
      assessmentStage = { status: "not_applicable", label: "Not required" };
    }

    return {
      outcomeId: outcome.id,
      kindLabel: OUTCOME_KIND_LABELS[outcome.kind],
      bloom: outcome.bloom,
      headline: capitalizeFirst(outcome.behavior) || "Untitled objective",
      tooltip: [outcome.condition, outcome.behavior, outcome.criterion]
        .filter(Boolean)
        .join(" — "),
      lessons: lessons.map((lesson) => ({ id: lesson.id, title: lesson.title })),
      lessonStage,
      practiceStage,
      assessment: assessment
        ? {
            id: assessment.id,
            label: ASSESSMENT_FORMAT_LABELS[assessment.format] ?? capitalizeFirst(assessment.format),
          }
        : undefined,
      assessmentStage,
    };
  });
}
