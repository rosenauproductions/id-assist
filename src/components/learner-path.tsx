"use client";

import type { LearnerPathLesson } from "@/lib/id/learner-path";

export function LearnerPath({
  lessons,
  onSelectLesson,
  onSelectAssessment,
}: {
  lessons: LearnerPathLesson[];
  onSelectLesson?: (id: string) => void;
  onSelectAssessment?: (id: string) => void;
}) {
  if (lessons.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing to walk through yet — compile or approve an outline first.
      </p>
    );
  }

  return (
    <ol className="grid gap-6">
      {lessons.map((lesson, index) => (
        <li key={lesson.id}>
          {index > 0 ? <hr className="mb-6 border-line" /> : null}
          <button
            type="button"
            onClick={() => onSelectLesson?.(lesson.id)}
            className="text-left hover:underline"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {lesson.moduleTitle}
            </p>
            <h3 className="font-medium">{lesson.title}</h3>
          </button>

          {lesson.beats.length > 0 ? (
            <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm">
              {lesson.beats.map((beat) => (
                <li key={beat.id}>{beat.text}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">No content written yet.</p>
          )}

          {lesson.assessment ? (
            <button
              type="button"
              onClick={() => onSelectAssessment?.(lesson.assessment!.id)}
              className="mt-2 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium hover:brightness-95"
            >
              Then: {lesson.assessment.label}
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
