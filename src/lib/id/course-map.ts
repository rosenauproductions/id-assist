import type { CourseOutline, FilterHit, GagneEvent } from "./types";

export type MapNodeKind = "module" | "lesson" | "unit" | "assessment";

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
};

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
export function buildCourseMap(outline: CourseOutline): CourseMapData {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const lessonsById = new Map(outline.lessons.map((lesson) => [lesson.id, lesson]));
  const assessmentsById = new Map(
    outline.assessments.map((assessment) => [assessment.id, assessment]),
  );

  outline.modules.forEach((courseModule, moduleIndex) => {
    nodes.push({
      id: courseModule.id,
      kind: "module",
      label: courseModule.title,
      order: moduleIndex,
      hasOpenFlag: hasOpenHit(outline.filters, courseModule.id),
    });

    courseModule.lessonIds.forEach((lessonId, lessonIndex) => {
      const lesson = lessonsById.get(lessonId);
      if (!lesson) return;

      nodes.push({
        id: lesson.id,
        kind: "lesson",
        label: lesson.title,
        order: lessonIndex,
        parentId: courseModule.id,
        hasOpenFlag: hasOpenHit(outline.filters, lesson.id),
      });
      edges.push({ from: courseModule.id, to: lesson.id });

      let previousStepId: string = lesson.id;
      lesson.units.forEach((unit, unitIndex) => {
        nodes.push({
          id: unit.id,
          kind: "unit",
          label: gagneLabel(unit.gagne),
          order: unitIndex,
          parentId: lesson.id,
        });
        edges.push({ from: previousStepId, to: unit.id });
        previousStepId = unit.id;
      });

      if (lesson.assessmentId) {
        const assessment = assessmentsById.get(lesson.assessmentId);
        if (assessment) {
          nodes.push({
            id: assessment.id,
            kind: "assessment",
            label: assessmentLabel(assessment.format),
            order: lesson.units.length,
            parentId: lesson.id,
            hasOpenFlag: hasOpenHit(outline.filters, assessment.id),
          });
          edges.push({ from: previousStepId, to: assessment.id });
        }
      }
    });
  });

  return { nodes, edges };
}

const GAGNE_LABELS: Record<GagneEvent, string> = {
  attention: "Gain attention",
  objectives: "State objective",
  recall: "Recall prior",
  present: "Present content",
  guide: "Guide practice",
  elicit: "Elicit performance",
  feedback: "Give feedback",
  assess: "Assess",
  retain: "Retention & transfer",
};

function gagneLabel(event: GagneEvent): string {
  return GAGNE_LABELS[event] ?? event;
}

function assessmentLabel(format: string): string {
  return `Check: ${format}`;
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
