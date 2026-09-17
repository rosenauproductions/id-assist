"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicketAction } from "@/app/tickets/actions";
import {
  TICKET_SCRIPTS,
  TICKET_TYPE_LABELS,
  type TicketType,
} from "@/lib/tickets/scripts";

// The "scripted bot" — a fixed, ordered question set (see scripts.ts)
// walked one question at a time, the same shape as the SME interview's
// live aid but without its AI coaching: a ticket doesn't need Bloom-level
// scrutiny, just enough structure that what lands in Chris's inbox is a
// filled-out ticket rather than a blank text box.
export function TicketBot({ type }: { type: TicketType }) {
  const router = useRouter();
  const questions = TICKET_SCRIPTS[type];
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const question = questions[stepIndex];
  const value = answers[question.id] ?? "";
  const isLast = stepIndex === questions.length - 1;
  const canAdvance = question.optional || value.trim().length > 0;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const ticketId = await createTicketAction(type, answers);
        router.push(`/tickets/${ticketId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit this.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-card p-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        {TICKET_TYPE_LABELS[type]}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${((stepIndex + 1) / questions.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Question {stepIndex + 1} of {questions.length}
      </p>

      <h2 className="mt-4 text-xl font-semibold">{question.prompt}</h2>
      <p className="mt-1 text-sm text-muted">
        {question.hint}
        {question.optional ? " (optional)" : ""}
      </p>
      <textarea
        autoFocus
        rows={4}
        value={value}
        placeholder={question.placeholder}
        onChange={(event) =>
          setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
        }
        className="field mt-4 w-full"
      />

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={stepIndex === 0 || pending}
          className="btn-secondary disabled:opacity-40"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canAdvance || pending}
          className="btn-primary disabled:opacity-50"
          onClick={() => {
            if (isLast) {
              submit();
            } else {
              setStepIndex((i) => Math.min(questions.length - 1, i + 1));
            }
          }}
        >
          {pending ? "Submitting…" : isLast ? "Submit" : "Next"}
        </button>
      </div>

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
