import { ASSESSMENT_FORMAT_LABELS, capitalizeFirst } from "./labels";
import { phaseCompletion } from "./requirements";
import type {
  AssessmentSpec,
  CourseOutline,
  CoursePhase,
  FilterHit,
  RequirementItem,
} from "./types";

export const MAP_NODE_KINDS = ["module", "lesson", "unit", "assessment"] as const;

export type MapNodeKind = (typeof MAP_NODE_KINDS)[number];

export const MAP_NODE_KIND_LABELS: Record<MapNodeKind, string> = {
  module: "Module",
  lesson: "Lesson",
  unit: "Unit",
  assessment: "Assessment",
};

/** Visual shape assigned to each node kind on the flowchart-style Map view
 * ("assign shapes to different tasks"). User-configurable, personal to the
 * account (see lib/settings/store.ts's getMapShapes/updateMapShapes) — this
 * is just the shared type plus the fallback used until it's customized.
 * The course-level Start/Finish bookends on that view are always a fixed
 * oval and aren't part of this map, since they aren't a MapNodeKind. */
export const NODE_SHAPES = [
  "circle",
  "square",
  "rounded-rectangle",
  "diamond",
  "hexagon",
] as const;

export type NodeShape = (typeof NODE_SHAPES)[number];

export const NODE_SHAPE_LABELS: Record<NodeShape, string> = {
  circle: "Circle",
  square: "Square",
  "rounded-rectangle": "Rounded rectangle",
  diamond: "Diamond",
  hexagon: "Hexagon",
};

export type MapShapeSettings = Record<MapNodeKind, NodeShape>;

export const DEFAULT_MAP_SHAPES: MapShapeSettings = {
  module: "circle",
  lesson: "square",
  unit: "rounded-rectangle",
  assessment: "diamond",
};

export type MapNode = {
  id: string;
  kind: MapNodeKind;
  label: string;
  /** Order within its parent's group — modules under the course, lessons
   * under their module, units/the assessment under their lesson. Purely
   * for layout; not a persisted field. */
  order: number;
  /** module.id for a lesson, lesson.id for a unit/assessment; undefined for
   * a top-level module. */
  parentId?: string;
  /** True when this node's own FilterHit(s) are unresolved and not just
   * informational — the same red-triangle condition FlagMarker uses (see
   * src/components/flag-marker.tsx), so a course map node can carry the
   * same signal without duplicating that logic. Skeleton nodes never set
   * this — there's nothing to audit yet. */
  hasOpenFlag?: boolean;
  /** True for a skeleton node estimated before compile — no real outline
   * exists yet, so the node isn't clickable and renders muted. */
  placeholder?: boolean;
  /** Construction/Completion view coloring. Derived, not stored: "issue"
   * wins whenever hasOpenFlag is set (an unresolved FilterHit targets this
   * node); otherwise it's bucketed from the RequirementItem done/total
   * percent of whichever CoursePhase this node's kind maps to (see
   * NODE_PHASE below) — no new per-node tracking field, per the roadmap
   * decision. Undefined for skeleton/placeholder nodes, which have
   * nothing to audit yet. */
  completion?: MapCompletion;
};

export type MapCompletion = "empty" | "partial" | "complete" | "issue";

/** Which CoursePhase's requirements-checklist percent drives a given node
 * kind's Construction/Completion coloring. Coarse by design (see roadmap
 * section 13, decision 6): every lesson node shares the content_development
 * phase's percent rather than tracking its own, since RequirementItem is
 * phase-scoped, not node-scoped, and this view intentionally reuses that
 * data as-is instead of adding a new tracking mechanism. */
const NODE_PHASE: Record<MapNodeKind, CoursePhase> = {
  module: "design",
  lesson: "content_development",
  unit: "content_development",
  assessment: "assessment",
};

function completionForPercent(percent: number): MapCompletion {
  if (percent >= 100) return "complete";
  if (percent <= 0) return "empty";
  return "partial";
}

function nodeCompletion(
  kind: MapNodeKind,
  percents: Record<CoursePhase, number>,
  hasOpenFlag: boolean,
): MapCompletion {
  if (hasOpenFlag) return "issue";
  return completionForPercent(percents[NODE_PHASE[kind]] ?? 0);
}

export type MapEdge = { from: string; to: string };

export type CourseMapData = {
  nodes: MapNode[];
  edges: MapEdge[];
};

function hasOpenHit(filters: FilterHit[], targetId: string): boolean {
  return filters.some(
    (filter) =>
      filter.targetId === targetId &&
      !filter.resolved &&
      filter.severity !== "pass",
  );
}

/**
 * Builds the real course map from a compiled outline: module → lesson →
 * (unit → unit → … →) assessment, in the order each piece is actually used,
 * with an edge for every step of that flow. This is what renders once
 * compileBrief() has run; see estimateSkeletonMap() for the
 * before-compile placeholder shown during the wizard.
 */
export function buildCourseMap(
  outline: CourseOutline,
  requirements: RequirementItem[] = [],
): CourseMapData {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const lessonsById = new Map(outline.lessons.map((lesson) => [lesson.id, lesson]));
  const assessmentsById = new Map(
    outline.assessments.map((assessment) => [assessment.id, assessment]),
  );
  const percents = Object.fromEntries(
    Object.entries(phaseCompletion(requirements)).map(([phase, stats]) => [
      phase,
      stats.percent,
    ]),
  ) as Record<CoursePhase, number>;

  outline.modules.forEach((courseModule, moduleIndex) => {
    const moduleFlag = hasOpenHit(outline.filters, courseModule.id);
    nodes.push({
      id: courseModule.id,
      kind: "module",
      label: courseModule.title,
      order: moduleIndex,
      hasOpenFlag: moduleFlag,
      completion: nodeCompletion("module", percents, moduleFlag),
    });

    courseModule.lessonIds.forEach((lessonId, lessonIndex) => {
      const lesson = lessonsById.get(lessonId);
      if (!lesson) return;

      const lessonFlag = hasOpenHit(outline.filters, lesson.id);
      nodes.push({
        id: lesson.id,
        kind: "lesson",
        label: lesson.title,
        order: lessonIndex,
        parentId: courseModule.id,
        hasOpenFlag: lessonFlag,
        completion: nodeCompletion("lesson", percents, lessonFlag),
      });
      edges.push({ from: courseModule.id, to: lesson.id });

      // Only the lesson and its assessment show up as their own boxes in
      // the default Construction map — the Gagné-event units inside a
      // lesson live in the Lessons tab (reached via the existing
      // click-through), not as separate nodes here. See the roadmap
      // decision behind this in the Stage 1 map-redesign notes.
      if (lesson.assessmentId) {
        const assessment = assessmentsById.get(lesson.assessmentId);
        if (assessment) {
          const assessmentFlag = hasOpenHit(outline.filters, assessment.id);
          nodes.push({
            id: assessment.id,
            kind: "assessment",
            label: assessmentLabel(assessment.format),
            order: 0,
            parentId: lesson.id,
            hasOpenFlag: assessmentFlag,
            completion: nodeCompletion("assessment", percents, assessmentFlag),
          });
          edges.push({ from: lesson.id, to: assessment.id });
        }
      }
    });
  });

  return { nodes, edges };
}

function assessmentLabel(format: AssessmentSpec["format"]): string {
  return ASSESSMENT_FORMAT_LABELS[format] ?? capitalizeFirst(format);
}

const MINUTES_PER_LESSON = 15;
const LESSONS_PER_MODULE = 3;
const MIN_LESSONS = 1;
const MAX_SKELETON_LESSONS = 12;
const SKELETON_UNIT_LABELS = ["Present", "Practice", "Feedback"];

/**
 * Estimates a rough module/lesson/unit skeleton from nothing but the
 * wizard's seat-time answer, with no AI call — shown while the brief is
 * still being filled in, before compileBrief() produces a real outline to
 * hand to buildCourseMap(). Every node here is a placeholder: unclickable,
 * generically labeled, and never carries a flag (there's nothing to audit
 * yet).
 */
export function estimateSkeletonMap(durationMinutes: number): CourseMapData {
  const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0
    ? durationMinutes
    : 0;
  const lessonCount = safeDuration === 0
    ? MIN_LESSONS
    : Math.min(
        MAX_SKELETON_LESSONS,
        Math.max(MIN_LESSONS, Math.round(safeDuration / MINUTES_PER_LESSON)),
      );
  const moduleCount = Math.max(1, Math.ceil(lessonCount / LESSONS_PER_MODULE));

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  let lessonsPlaced = 0;
  for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex += 1) {
    const moduleId = `skeleton-module-${moduleIndex}`;
    nodes.push({
      id: moduleId,
      kind: "module",
      label: `Module ${moduleIndex + 1}`,
      order: moduleIndex,
      placeholder: true,
    });

    const remainingModules = moduleCount - moduleIndex;
    const remainingLessons = lessonCount - lessonsPlaced;
    const lessonsInThisModule = Math.max(
      1,
      Math.round(remainingLessons / remainingModules),
    );

    for (
      let lessonIndex = 0;
      lessonIndex < lessonsInThisModule && lessonsPlaced < lessonCount;
      lessonIndex += 1, lessonsPlaced += 1
    ) {
      const lessonId = `skeleton-lesson-${moduleIndex}-${lessonIndex}`;
      nodes.push({
        id: lessonId,
        kind: "lesson",
        label: `Lesson ${moduleIndex + 1}.${lessonIndex + 1}`,
        order: lessonIndex,
        parentId: moduleId,
        placeholder: true,
      });
      edges.push({ from: moduleId, to: lessonId });

      let previousStepId = lessonId;
      SKELETON_UNIT_LABELS.forEach((label, unitIndex) => {
        const unitId = `${lessonId}-unit-${unitIndex}`;
        nodes.push({
          id: unitId,
          kind: "unit",
          label,
          order: unitIndex,
          parentId: lessonId,
          placeholder: true,
        });
        edges.push({ from: previousStepId, to: unitId });
        previousStepId = unitId;
      });

      const assessmentId = `${lessonId}-check`;
      nodes.push({
        id: assessmentId,
        kind: "assessment",
        label: "Check",
        order: SKELETON_UNIT_LABELS.length,
        parentId: lessonId,
        placeholder: true,
      });
      edges.push({ from: previousStepId, to: assessmentId });
    }
  }

  return { nodes, edges };
}
