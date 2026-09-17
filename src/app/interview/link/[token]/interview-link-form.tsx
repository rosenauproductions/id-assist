"use client";

import { useState, useTransition } from "react";
import { FIELD_COACH } from "@/lib/id/brief-coach";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/id/brief-validate";
import type { InterviewAnswers } from "@/lib/interview/store";
import {
  saveInterviewLinkAnswersAction,
  submitInterviewLinkAction,
} from "../../link-actions";

const INTERVIEW_STEPS = WIZARD_STEPS.filter((step) => step.id !== "delivery");

export function InterviewLinkForm({
  token,
  initialAnswers,
  initialSubmitted,
  courseWorkingTitle,
}: {
  token: string;
  initialAnswers: InterviewAnswers;
  initialSubmitted: boolean;
  courseWorkingTitle: string | null;
}) {
  const [answers, setAnswers] = useState<InterviewAnswers>(initialAnswers);
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(step: WizardStepId, questionId: string, value: string) {
    setSaved(false);
    setAnswers((prev) => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [questionId]: value },
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveInterviewLinkAnswersAction(token, answers);
        setSaved(true);
      } catch {
        setError("Could not save your answers — check your connection and try again.");
      }
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveInterviewLinkAnswersAction(token, answers);
        await submitInterviewLinkAction(token);
        setSubmitted(true);
      } catch {
        setError("Could not submit — check your connection and try again.");
      }
    });
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">Thanks — that&apos;s everything.</p>
        <p className="mt-2 text-sm text-muted">
          Your answers have been sent back to the course designer. You can
          close this page.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Course interview
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {courseWorkingTitle
          ? `Help build: ${courseWorkingTitle}`
          : "A few questions about your work"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Answer in your own words — there are no wrong answers. You can save
        and come back later, or submit when you&apos;re done.
      </p>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-4">
        {INTERVIEW_STEPS.map((step) => (
          <section key={step.id} className="rounded-xl border border-line bg-card p-5">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <div className="mt-3 grid gap-3">
              {FIELD_COACH[step.id].questions.map((question) => (
                <label key={question.id} className="grid gap-1 text-sm">
                  <span className="font-medium">{question.prompt}</span>
                  <textarea
                    rows={2}
                    className="field"
                    placeholder={question.placeholder}
                    value={answers[step.id]?.[question.id] ?? ""}
                    onChange={(event) => setAnswer(step.id, question.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent/40 disabled:opacity-50"
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save & continue later"}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Submit
        </button>
      </div>

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
