"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectFromDraftAction } from "@/app/actions";
import {
  DELIVERY_TARGETS,
  type DeliveryTarget,
} from "@/lib/id/types";
import {
  composeFieldFromAnswers,
  enrichEvaluation,
  FIELD_COACH,
  type DevelopQuestion,
} from "@/lib/id/brief-coach";
import {
  emptyBriefDraft,
  WIZARD_STEPS,
  type BriefDraft,
  type FieldEvaluation,
  type WizardStepId,
} from "@/lib/id/brief-validate";

const DELIVERY_LABELS: Record<DeliveryTarget, string> = {
  rise: "Rise build sheet",
  canvas: "Canvas pages",
  gdoc: "Google Doc",
  gslides: "Google Slides",
  video: "Video script",
  tutor: "Live tutor",
};

type CoachResponse = {
  evaluation: FieldEvaluation;
  suggestedRewrites: string[];
  clarifyingQuestions: string[];
  composedValue?: string;
  coachNote: string;
  source: "rules" | "model";
};

export function BriefWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BriefDraft>(emptyBriefDraft);
  const [evaluation, setEvaluation] = useState<FieldEvaluation | null>(null);
  const [liveEval, setLiveEval] = useState<FieldEvaluation | null>(null);
  const [suggestedRewrites, setSuggestedRewrites] = useState<string[]>([]);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [developOpen, setDevelopOpen] = useState(false);
  const [developAnswers, setDevelopAnswers] = useState<Record<string, string>>(
    {},
  );
  const [composedPreview, setComposedPreview] = useState<string | null>(null);

  const step = WIZARD_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / WIZARD_STEPS.length) * 100;
  const developQuestions = FIELD_COACH[step.id].questions;

  const currentValue = useMemo(() => {
    if (step.id === "durationMinutes") return String(draft.durationMinutes);
    if (step.id === "delivery") return draft.delivery.join(",");
    return String(draft[step.id] ?? "");
  }, [draft, step]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = enrichEvaluation(step.id, draft, attempts);
      setLiveEval(next);
      setSuggestedRewrites(next.suggestedRewrites ?? []);
      if (next.looksStuck && !developOpen && !next.ok) {
        setCoachNote(
          "This field looks thin — try a suggestion, or answer a few questions to develop it.",
        );
      } else if (next.ok) {
        setCoachNote(null);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, step.id, attempts, developOpen]);

  function resetStepCoach() {
    setEvaluation(null);
    setError(null);
    setDevelopOpen(false);
    setDevelopAnswers({});
    setComposedPreview(null);
    setCoachNote(null);
  }

  function updateField(id: WizardStepId, value: string | number | DeliveryTarget[]) {
    setDraft((prev) => ({ ...prev, [id]: value }));
    setEvaluation(null);
    setError(null);
    setComposedPreview(null);
  }

  function applyRewrite(text: string) {
    if (step.id === "durationMinutes") {
      updateField("durationMinutes", Number(text) || 0);
    } else if (step.id === "delivery") {
      return;
    } else {
      updateField(step.id, text);
    }
    setCoachNote("Suggestion applied — tighten if needed, then check.");
  }

  async function fetchCoach(mode: "suggest" | "compose") {
    setCoachBusy(true);
    try {
      const res = await fetch("/api/brief-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: step.id,
          draft,
          mode,
          answers: mode === "compose" ? developAnswers : undefined,
          attempts,
        }),
      });
      if (!res.ok) throw new Error("Coach request failed");
      const data = (await res.json()) as CoachResponse;
      setLiveEval(data.evaluation);
      setSuggestedRewrites(data.suggestedRewrites);
      setCoachNote(data.coachNote);
      if (data.composedValue) setComposedPreview(data.composedValue);
      return data;
    } catch {
      const local = enrichEvaluation(step.id, draft, attempts);
      setLiveEval(local);
      setSuggestedRewrites(local.suggestedRewrites ?? []);
      if (mode === "compose") {
        const composed = composeFieldFromAnswers(step.id, developAnswers, draft);
        setComposedPreview(composed || null);
      }
      setCoachNote("Using built-in coaching (model unavailable).");
      return null;
    } finally {
      setCoachBusy(false);
    }
  }

  function openDevelop() {
    setDevelopOpen(true);
    setDevelopAnswers({});
    setComposedPreview(null);
    void fetchCoach("suggest");
  }

  function advanceTo(nextDraft: BriefDraft) {
    if (stepIndex >= WIZARD_STEPS.length - 1) {
      startTransition(async () => {
        try {
          const id = await createProjectFromDraftAction(nextDraft);
          router.push(`/projects/${id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not compile");
        }
      });
      return;
    }
    setStepIndex((i) => i + 1);
    setAttempts(0);
    resetStepCoach();
  }

  function checkAndAdvance() {
    const nextDraft = { ...draft };
    if (step.id === "constraints" && !nextDraft.constraints.trim()) {
      nextDraft.constraints = "None";
      setDraft(nextDraft);
    }
    const result = enrichEvaluation(step.id, nextDraft, attempts + 1);
    setEvaluation(result);
    setLiveEval(result);
    setSuggestedRewrites(result.suggestedRewrites ?? []);
    setAttempts((n) => n + 1);
    if (!result.ok) {
      if (result.looksStuck) {
        setCoachNote(
          "Still not designable yet. Use a suggestion or develop this field with questions.",
        );
        setDevelopOpen(true);
      }
      void fetchCoach("suggest");
      return;
    }

    advanceTo(nextDraft);
  }

  function continueAnyway() {
    advanceTo(draft);
  }

  const displayEval = evaluation ?? liveEval;
  const showCoach =
    Boolean(displayEval) &&
    step.input !== "delivery" &&
    (!displayEval?.ok || (suggestedRewrites.length > 0 && !evaluation?.ok));

  const showAside =
    step.input !== "delivery" &&
    (suggestedRewrites.length > 0 ||
      developOpen ||
      (showCoach && displayEval && !displayEval.ok) ||
      Boolean(coachNote));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Wizard mode
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Build the brief one answer at a time
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Each field coaches as you write — suggestions, clarifying questions, and
        a develop path when you are stuck.
      </p>

      <div className="mt-6 h-2 max-w-2xl overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Step {stepIndex + 1} of {WIZARD_STEPS.length} · {step.title}
      </p>

      <div
        className={`mt-6 grid gap-6 ${showAside ? "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start" : ""}`}
      >
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="text-xl font-semibold">{step.prompt}</h2>
          <p className="mt-2 text-sm text-muted">{step.hint}</p>

          <div className="mt-5">
            {step.input === "text" ? (
              <input
                className="field w-full"
                value={currentValue}
                placeholder={step.placeholder}
                onChange={(e) => updateField(step.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    checkAndAdvance();
                  }
                }}
                autoFocus
              />
            ) : null}
            {step.input === "textarea" ? (
              <textarea
                className="field w-full"
                rows={4}
                value={currentValue}
                placeholder={step.placeholder}
                onChange={(e) => updateField(step.id, e.target.value)}
                autoFocus
              />
            ) : null}
            {step.input === "number" ? (
              <input
                className="field w-full"
                type="number"
                min={10}
                max={180}
                value={draft.durationMinutes}
                onChange={(e) =>
                  updateField("durationMinutes", Number(e.target.value) || 0)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    checkAndAdvance();
                  }
                }}
                autoFocus
              />
            ) : null}
            {step.input === "delivery" ? (
              <div className="grid gap-2">
                {DELIVERY_TARGETS.map((target) => {
                  const checked = draft.delivery.includes(target);
                  return (
                    <label
                      key={target}
                      className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? draft.delivery.filter((item) => item !== target)
                            : [...draft.delivery, target];
                          updateField("delivery", next);
                        }}
                      />
                      {DELIVERY_LABELS[target]}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          {step.input !== "delivery" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={coachBusy}
                onClick={() => void fetchCoach("suggest")}
              >
                {coachBusy ? "Coaching…" : "Suggest changes"}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={openDevelop}
              >
                {developOpen ? "Developing…" : "Help me develop this"}
              </button>
            </div>
          ) : null}

          {evaluation?.ok ? (
            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
              {evaluation.summary}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-danger">{error}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={stepIndex === 0 || pending}
              className="btn-secondary disabled:opacity-40"
              onClick={() => {
                setStepIndex((i) => Math.max(0, i - 1));
                setAttempts(0);
                resetStepCoach();
              }}
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              className="btn-primary disabled:opacity-50"
              onClick={checkAndAdvance}
            >
              {pending
                ? "Compiling…"
                : stepIndex >= WIZARD_STEPS.length - 1
                  ? "Check & compile outline"
                  : evaluation && !evaluation.ok
                    ? "Check again"
                    : "Check & continue"}
            </button>
            {attempts >= 2 && evaluation && !evaluation.ok ? (
              <button
                type="button"
                disabled={pending}
                className="text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground disabled:opacity-40"
                onClick={continueAnyway}
                title="The coach isn't satisfied, but you can move on and refine this later."
              >
                Continue anyway
              </button>
            ) : null}
          </div>
        </section>

        {showAside ? (
          <aside className="grid gap-4 lg:sticky lg:top-6">
            {coachNote ? (
              <p className="text-sm text-muted">{coachNote}</p>
            ) : null}

            {showCoach && displayEval && !displayEval.ok ? (
              <div className="rounded-xl border border-warn/40 bg-warn/5 px-4 py-3">
                <p className="text-sm font-semibold text-warn">Needs clarity</p>
                <p className="mt-1 text-sm">{displayEval.summary}</p>
                {displayEval.issues.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {displayEval.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                {(displayEval.clarifyingQuestions.length > 0 ||
                  (liveEval?.clarifyingQuestions.length ?? 0) > 0) &&
                !developOpen ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Questions to sharpen this
                    </p>
                    <ul className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                      {(displayEval.clarifyingQuestions.length
                        ? displayEval.clarifyingQuestions
                        : liveEval?.clarifyingQuestions ?? []
                      ).map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {displayEval.rewriteHints.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {displayEval.rewriteHints.map((hint) => (
                      <li key={hint}>Hint: {hint}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {suggestedRewrites.length > 0 ? (
              <div className="rounded-xl border border-line bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Suggested rewrites — click to use
                </p>
                <div className="mt-2 grid gap-2">
                  {suggestedRewrites.map((rewrite) => (
                    <button
                      key={rewrite}
                      type="button"
                      className="rounded-md border border-line bg-background px-3 py-2 text-left text-sm hover:border-accent"
                      onClick={() => applyRewrite(rewrite)}
                    >
                      {rewrite}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {developOpen && developQuestions.length > 0 ? (
              <DevelopPanel
                questions={developQuestions}
                answers={developAnswers}
                preview={composedPreview}
                busy={coachBusy}
                onChange={(id, value) =>
                  setDevelopAnswers((prev) => ({ ...prev, [id]: value }))
                }
                onCompose={() => {
                  const local = composeFieldFromAnswers(
                    step.id,
                    developAnswers,
                    draft,
                  );
                  setComposedPreview(local || null);
                  void fetchCoach("compose");
                }}
                onUse={(value) => {
                  applyRewrite(value);
                  setDevelopOpen(false);
                }}
                onClose={() => setDevelopOpen(false)}
              />
            ) : null}
          </aside>
        ) : null}
      </div>

      <details className="mt-6 rounded-xl border border-line bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Answers so far</summary>
        <dl className="mt-3 grid gap-2 text-muted">
          <div>
            <dt className="text-xs uppercase tracking-wide">Title</dt>
            <dd>{draft.title || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Audience</dt>
            <dd>{draft.audience || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Job task</dt>
            <dd>{draft.jobTask || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Why now</dt>
            <dd>{draft.whyNow || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Seat time</dt>
            <dd>{draft.durationMinutes} min</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Constraints</dt>
            <dd>{draft.constraints || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Delivery</dt>
            <dd>{draft.delivery.join(", ") || "—"}</dd>
          </div>
        </dl>
      </details>

      <style>{`
        .field {
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.65rem 0.75rem;
        }
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .btn-secondary {
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--card);
          padding: 0.5rem 0.85rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function DevelopPanel({
  questions,
  answers,
  preview,
  busy,
  onChange,
  onCompose,
  onUse,
  onClose,
}: {
  questions: DevelopQuestion[];
  answers: Record<string, string>;
  preview: string | null;
  busy: boolean;
  onChange: (id: string, value: string) => void;
  onCompose: () => void;
  onUse: (value: string) => void;
  onClose: () => void;
}) {
  const answered = questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Develop this field</p>
          <p className="mt-1 text-xs text-muted">
            Answer what you can ({answered}/{questions.length}). We will draft
            the field from your answers.
          </p>
        </div>
        <button type="button" className="text-xs text-muted" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {questions.map((question, index) => (
          <label key={question.id} className="grid gap-1 text-sm">
            <span className="font-medium">
              {index + 1}. {question.prompt}
            </span>
            <input
              className="field w-full"
              value={answers[question.id] ?? ""}
              placeholder={question.placeholder}
              onChange={(e) => onChange(question.id, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary disabled:opacity-50"
          disabled={busy || answered === 0}
          onClick={onCompose}
        >
          {busy ? "Drafting…" : "Draft from answers"}
        </button>
      </div>

      {preview ? (
        <div className="mt-4 rounded-md border border-line bg-background px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Draft for this field
          </p>
          <p className="mt-2 text-sm">{preview}</p>
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={() => onUse(preview)}
          >
            Use this draft
          </button>
        </div>
      ) : null}
    </div>
  );
}
