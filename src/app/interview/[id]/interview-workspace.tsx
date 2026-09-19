"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProjectFromInterviewAction,
  saveInterviewAnswersAction,
} from "../actions";
import { composeFieldFromAnswers } from "@/lib/id/brief-coach";
import { FIELD_COACH } from "@/lib/id/brief-coach";
import {
  WIZARD_STEPS,
  emptyBriefDraft,
  evaluateWizardField,
  type BriefDraft,
  type WizardStepId,
} from "@/lib/id/brief-validate";
import { DELIVERY_TARGETS, type DeliveryTarget } from "@/lib/id/types";
import type { InterviewAnswers, InterviewSession } from "@/lib/interview/store";

const INTERVIEW_STEPS = WIZARD_STEPS.filter((step) => step.id !== "delivery");

const DELIVERY_LABELS: Record<DeliveryTarget, string> = {
  rise: "Rise build sheet",
  canvas: "Canvas pages",
  gdoc: "Google Doc",
  gslides: "Google Slides",
  video: "Video script",
  tutor: "Live tutor",
};

function synthesizeDraft(
  answers: InterviewAnswers,
  defaultDelivery: DeliveryTarget[],
): BriefDraft {
  const base = emptyBriefDraft();
  const compose = (step: WizardStepId) =>
    composeFieldFromAnswers(step, answers[step] ?? {}, base);
  const durationText = compose("durationMinutes");
  return {
    title: compose("title"),
    audience: compose("audience"),
    jobTask: compose("jobTask"),
    whyNow: compose("whyNow"),
    durationMinutes: Number(durationText) || base.durationMinutes,
    constraints: compose("constraints") || "None",
    delivery: defaultDelivery.length ? defaultDelivery : [...DELIVERY_TARGETS],
  };
}

export function InterviewWorkspace({
  session,
  defaultDelivery,
}: {
  session: InterviewSession;
  defaultDelivery: DeliveryTarget[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<InterviewAnswers>(session.answers);
  const [stage, setStage] = useState<"interview" | "review">("interview");
  const [draft, setDraft] = useState<BriefDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/interview/link/${session.token}`
      : `/interview/link/${session.token}`;

  function setAnswer(step: WizardStepId, questionId: string, value: string) {
    setSaved(false);
    setAnswers((prev) => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [questionId]: value },
    }));
  }

  function saveAnswers() {
    setError(null);
    startTransition(async () => {
      try {
        await saveInterviewAnswersAction(session.id, answers);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save answers");
      }
    });
  }

  function copyLink() {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("Could not copy the link — copy it manually."));
  }

  function enterReview() {
    setDraft(synthesizeDraft(answers, defaultDelivery));
    setStage("review");
  }

  function createProject() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        const projectId = await createProjectFromInterviewAction(session.id, draft);
        router.push(`/projects/${projectId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create project");
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Interview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {session.courseWorkingTitle || "Untitled interview"}
          </h1>
          {session.smeName ? (
            <p className="mt-1 text-sm text-muted">with {session.smeName}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-md border border-line px-3 py-2 text-xs font-medium hover:border-accent/40"
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Send the link above to the SME if you&apos;d rather they answer some
        of this on their own — both feed the same answers below.
      </p>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {stage === "interview" ? (
        <>
          <div className="mt-6 grid gap-4">
            {INTERVIEW_STEPS.map((step) => (
              <section
                key={step.id}
                className="rounded-xl border border-line bg-card p-5"
              >
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm text-muted">{step.hint}</p>
                <div className="mt-4 grid gap-3">
                  {FIELD_COACH[step.id].questions.map((question) => (
                    <label key={question.id} className="grid gap-1 text-sm">
                      <span className="font-medium">{question.prompt}</span>
                      <textarea
                        rows={2}
                        className="field"
                        placeholder={question.placeholder}
                        value={answers[step.id]?.[question.id] ?? ""}
                        onChange={(event) =>
                          setAnswer(step.id, question.id, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                {(() => {
                  const preview = composeFieldFromAnswers(
                    step.id,
                    answers[step.id] ?? {},
                    emptyBriefDraft(),
                  );
                  return preview ? (
                    <p className="mt-3 rounded-md bg-background px-3 py-2 text-xs text-muted">
                      Synthesized: {preview}
                    </p>
                  ) : null;
                })()}
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveAnswers}
              disabled={pending}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent/40 disabled:opacity-50"
            >
              {pending ? "Saving…" : saved ? "Saved" : "Save answers"}
            </button>
            <button
              type="button"
              onClick={enterReview}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Review brief →
            </button>
          </div>
        </>
      ) : (
        <ReviewStage
          draft={draft as BriefDraft}
          setDraft={setDraft as (draft: BriefDraft) => void}
          pending={pending}
          onBack={() => setStage("interview")}
          onCreate={createProject}
        />
      )}

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.5rem 0.7rem;
        }
      `}</style>
    </main>
  );
}

function ReviewStage({
  draft,
  setDraft,
  pending,
  onBack,
  onCreate,
}: {
  draft: BriefDraft;
  setDraft: (draft: BriefDraft) => void;
  pending: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  function evaluation(step: WizardStepId) {
    return evaluateWizardField(step, draft);
  }

  return (
    <section className="mt-6 grid gap-4">
      <p className="text-sm text-muted">
        This is what the interview answers synthesized into. Edit anything
        before creating the project — the same quality checks the wizard
        uses still apply.
      </p>

      <ReviewField
        label="Course name"
        evalResult={evaluation("title")}
      >
        <input
          className="field"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </ReviewField>

      <ReviewField label="Audience" evalResult={evaluation("audience")}>
        <input
          className="field"
          value={draft.audience}
          onChange={(event) => setDraft({ ...draft, audience: event.target.value })}
        />
      </ReviewField>

      <ReviewField label="Job task" evalResult={evaluation("jobTask")}>
        <textarea
          rows={3}
          className="field"
          value={draft.jobTask}
          onChange={(event) => setDraft({ ...draft, jobTask: event.target.value })}
        />
      </ReviewField>

      <ReviewField label="Why now" evalResult={evaluation("whyNow")}>
        <textarea
          rows={2}
          className="field"
          value={draft.whyNow}
          onChange={(event) => setDraft({ ...draft, whyNow: event.target.value })}
        />
      </ReviewField>

      <div className="grid grid-cols-2 gap-4">
        <ReviewField
          label="Seat time (minutes)"
          evalResult={evaluation("durationMinutes")}
        >
          <input
            type="number"
            min={10}
            className="field"
            value={draft.durationMinutes}
            onChange={(event) =>
              setDraft({ ...draft, durationMinutes: Number(event.target.value) || 0 })
            }
          />
        </ReviewField>
        <ReviewField label="Constraints" evalResult={evaluation("constraints")}>
          <input
            className="field"
            value={draft.constraints}
            onChange={(event) => setDraft({ ...draft, constraints: event.target.value })}
          />
        </ReviewField>
      </div>

      <div>
        <p className="text-sm font-medium">Delivery</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {DELIVERY_TARGETS.map((target) => (
            <label
              key={target}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2"
            >
              <input
                type="checkbox"
                checked={draft.delivery.includes(target)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...draft.delivery, target]
                    : draft.delivery.filter((item) => item !== target);
                  setDraft({ ...draft, delivery: next });
                }}
              />
              {DELIVERY_LABELS[target]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent/40"
        >
          ← Back to questions
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </section>
  );
}

function ReviewField({
  label,
  evalResult,
  children,
}: {
  label: string;
  evalResult: ReturnType<typeof evaluateWizardField>;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex items-center justify-between font-medium">
        {label}
        <span className={evalResult.ok ? "text-xs text-accent" : "text-xs text-warn"}>
          {evalResult.ok ? "Ready" : evalResult.issues[0] ?? "Needs work"}
        </span>
      </span>
      {children}
    </label>
  );
}
