"use client";

import type { AlignmentRow, AlignmentStage, AlignmentStageStatus } from "@/lib/id/alignment-map";

const STAGE_TEXT: Record<AlignmentStageStatus, string> = {
  ok: "text-accent",
  warning: "text-warn",
  missing: "text-danger",
  accepted: "text-muted",
  not_applicable: "text-muted",
};

const ARROW_BY_STATUS: Record<AlignmentStageStatus, string> = {
  ok: "→",
  warning: "⇢",
  missing: "⇢",
  accepted: "⇢",
  not_applicable: "→",
};

export function AlignmentMap({
  rows,
  onSelectOutcome,
  onSelectLesson,
  onSelectAssessment,
}: {
  rows: AlignmentRow[];
  onSelectOutcome?: (id: string) => void;
  onSelectLesson?: (id: string) => void;
  onSelectAssessment?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No objectives yet — add one in the Outcomes tab.
      </p>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.outcomeId} className="rounded-lg border border-line bg-background p-4">
          <button
            type="button"
            onClick={() => onSelectOutcome?.(row.outcomeId)}
            title={row.tooltip}
            className="text-left hover:underline"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {row.kindLabel} · {row.bloom}
            </p>
            <p className="font-medium">{row.headline}</p>
          </button>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {row.lessons.length > 0 ? (
              row.lessons.map((lesson, index) => (
                <span key={lesson.id} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-muted">+</span> : null}
                  <button
                    type="button"
                    onClick={() => onSelectLesson?.(lesson.id)}
                    className="rounded-full border border-line bg-card px-2.5 py-1 font-medium hover:brightness-95"
                  >
                    {lesson.title}
                  </button>
                </span>
              ))
            ) : (
              <StageChip label={row.lessonStage.label} status={row.lessonStage.status} />
            )}

            <StageArrow stage={row.lessonStage} />

            <StageChip label={row.practiceStage.label} status={row.practiceStage.status} />

            <StageArrow stage={row.practiceStage} />

            {row.assessment ? (
              <button
                type="button"
                onClick={() => onSelectAssessment?.(row.assessment!.id)}
                className="rounded-full border border-line bg-card px-2.5 py-1 font-medium hover:brightness-95"
              >
                {row.assessment.label}
              </button>
            ) : (
              <StageChip label={row.assessmentStage.label} status={row.assessmentStage.status} />
            )}
          </div>

          <AlignmentNotes stages={[row.lessonStage, row.practiceStage, row.assessmentStage]} />
        </li>
      ))}
    </ul>
  );
}

function StageChip({ label, status }: { label: string; status: AlignmentStageStatus }) {
  const tone =
    status === "missing"
      ? "border-danger/30 bg-danger/5 text-danger"
      : status === "warning"
        ? "border-warn/30 bg-warn/5 text-warn"
        : status === "accepted"
          ? "border-line bg-card text-muted"
          : status === "ok"
            ? "border-accent/30 bg-accent/5 text-accent"
            : "border-line bg-card text-muted";
  return (
    <span className={`rounded-full border px-2.5 py-1 font-medium ${tone}`}>{label}</span>
  );
}

function StageArrow({ stage }: { stage: AlignmentStage }) {
  return (
    <span className={`text-base leading-none ${STAGE_TEXT[stage.status]}`} aria-hidden>
      {ARROW_BY_STATUS[stage.status]}
    </span>
  );
}

function AlignmentNotes({ stages }: { stages: AlignmentStage[] }) {
  const notes = stages.filter(
    (stage) => stage.detail && (stage.status === "warning" || stage.status === "missing" || stage.status === "accepted"),
  );
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 grid gap-0.5">
      {notes.map((stage, index) => (
        <li key={index} className={`text-xs ${STAGE_TEXT[stage.status]}`}>
          {stage.status === "missing" || stage.status === "warning" ? "⚠ " : ""}
          {stage.detail}
        </li>
      ))}
    </ul>
  );
}
