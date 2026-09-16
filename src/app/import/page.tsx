"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importOutlineAction } from "@/app/actions";

const PLACEHOLDER = `Paste anything you've already got — a module/lesson list, headings with bullet points, prose you copied out of a Word doc, whatever shape it's in.

Example:

Module 1: Reading a Sev-2 timeline
- Lesson: Spot the decision points in a chat export
- Lesson: Separate facts from speculation

Module 2: Writing the review
- Lesson: Draft a blameless summary from the timeline
- Lesson: Get peer feedback against the no-blame checklist
`;

export default function ImportOutlinePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await importOutlineAction(text);
        router.push(`/projects/${id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not digest that outline.",
        );
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>

      <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Import
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Drop in a fully formed outline
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Paste an outline you already wrote, in whatever shape it&apos;s in.
        The model reads it and maps it into modules, lessons, Bloom&apos;s-gated
        objectives, and assessment ideas — then runs it through the same
        gap-detection every other project gets here. Review everything
        afterward; this is a fast first pass, not a finished course.
      </p>

      <section className="mt-6 rounded-xl border border-line bg-card p-6">
        <label className="text-sm font-medium" htmlFor="outline-text">
          Outline
        </label>
        <textarea
          id="outline-text"
          className="field mt-2 w-full"
          rows={16}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted">
          {text.trim().length < 40
            ? "Paste in the full outline — a sentence or two won't give it enough to work with."
            : `${text.trim().length.toLocaleString()} characters`}
        </p>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            disabled={pending || text.trim().length < 40}
            onClick={submit}
          >
            {pending ? "Digesting…" : "Digest outline"}
          </button>
          <span className="text-xs text-muted">
            This calls the AI model once — it can take a few seconds for a
            long outline.
          </span>
        </div>
      </section>

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
      `}</style>
    </main>
  );
}
