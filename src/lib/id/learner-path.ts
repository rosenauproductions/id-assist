import { ASSESSMENT_FORMAT_LABELS, capitalizeFirst } from "./labels";
import type { CourseOutline } from "./types";
import { unitText } from "./types";

// The Learner Path view answers a different question than Construction or
// Alignment: what does the learner actually experience, in order? So it
// walks the course the way a learner would sit through it — module by
// module, lesson by lesson, beat by beat — and shows each beat's actual
// content (unitText(): the hand-written content once someone's written
// it, otherwise the plain-English purpose it was compiled with). No
// Gagné-event names appear here at all; that structure stays inside the
// Lessons tab.

export type LearnerPathBeat = { id: string; text: string };

export type LearnerPathLesson = {
  id: string;
  title: string;
  moduleTitle: string;
  beats: LearnerPathBeat[];
  assessment?: { id: string; label: string };
};

export function buildLearnerPath(outline: CourseOutline): LearnerPathLesson[] {
  const lessonsById = new Map(outline.lessons.map((lesson) => [lesson.id, lesson]));
  const assessmentsById = new Map(
    outline.assessments.map((assessment) => [assessment.id, assessment]),
  );

  const result: LearnerPathLesson[] = [];
  for (const courseModule of outline.modules) {
    for (const lessonId of courseModule.lessonIds) {
      const lesson = lessonsById.get(lessonId);
      if (!lesson) continue;

      const assessment = lesson.assessmentId
        ? assessmentsById.get(lesson.assessmentId)
        : undefined;

      result.push({
        id: lesson.id,
        title: lesson.title,
        moduleTitle: courseModule.title,
        beats: lesson.units.map((unit) => ({ id: unit.id, text: unitText(unit) })),
        assessment: assessment
          ? {
              id: assessment.id,
              label: ASSESSMENT_FORMAT_LABELS[assessment.format] ?? capitalizeFirst(assessment.format),
            }
          : undefined,
      });
    }
  }
  return result;
}
