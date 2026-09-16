import Link from "next/link";
import type { ReactNode } from "react";
import { createProjectAction } from "@/app/actions";
import { DELIVERY_TARGETS } from "@/lib/id/types";

const LABELS: Record<(typeof DELIVERY_TARGETS)[number], string> = {
  rise: "Rise build sheet",
  canvas: "Canvas pages",
  gdoc: "Google Doc",
  gslides: "Google Slides",
  video: "Video script",
  tutor: "Live tutor",
};

const DELIVERY_HINTS: Record<(typeof DELIVERY_TARGETS)[number], string> = {
  rise: "Interactive elearning blocks you build in Rise.",
  canvas: "LMS pages and assignments to paste into Canvas.",
  gdoc: "Job aids, templates, and written practice.",
  gslides: "Presentation decks for facilitated or self-paced review.",
  video: "Script + shot list — not a rendered video file.",
  tutor: "Real-time Ollama coach that teaches the approved outline.",
};

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <section className="mt-4 rounded-xl border border-line bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
          Step 1 · Brief
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          New course brief
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Compile a pedagogy outline first. Approve it. Then create delivery
          files and tutor with your local Ollama model.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/wizard"
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Start wizard instead
          </Link>
          <span className="self-center text-xs text-muted">
            or fill the full form below
          </span>
        </div>
        <form action={createProjectAction} className="mt-8 grid gap-4">
          <Field
            label="Course name"
            hint="Working title learners and stakeholders will recognize."
          >
            <input
              required
              name="title"
              className="field"
              placeholder="Writing a blameless post-incident review"
            />
          </Field>
          <Field
            label="Audience"
            hint="Who takes this course — role, experience level, and context."
          >
            <input
              required
              name="audience"
              className="field"
              placeholder="Engineering leads and incident commanders"
            />
          </Field>
          <Field
            label="Job task (what they must be able to do)"
            hint="Observable on-the-job performance after the course — not a topic list."
          >
            <textarea
              required
              name="jobTask"
              rows={3}
              className="field"
              placeholder="Write a facts-only PIR from a Sev-2 timeline"
            />
          </Field>
          <Field
            label="Why now"
            hint="Workplace cost of not doing this. Adults need relevance up front."
          >
            <textarea
              name="whyNow"
              rows={2}
              className="field"
              placeholder="Blame language is killing incident reporting"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Seat time (minutes)"
              hint="Learner time in the course — not build time. Hard budget for lesson chunking."
            >
              <input
                name="durationMinutes"
                type="number"
                min={10}
                defaultValue={25}
                className="field"
              />
            </Field>
            <Field
              label="Constraints"
              hint="Limits that shape design: async only, no video, compliance, tools, etc."
            >
              <input
                name="constraints"
                className="field"
                placeholder="Async, no live workshop"
              />
            </Field>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Build mix</legend>
            <p className="text-xs font-normal leading-5 text-muted">
              Channels this course may ship in. One course can mix several; the
              outline assigns lessons to the best fit.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {DELIVERY_TARGETS.map((target) => (
                <label
                  key={target}
                  className="flex flex-col gap-0.5 rounded-md border border-line px-3 py-2"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      name={`delivery-${target}`}
                      defaultChecked
                    />
                    {LABELS[target]}
                  </span>
                  <span className="pl-6 text-xs font-normal text-muted">
                    {DELIVERY_HINTS[target]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="mt-2 w-fit rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Compile outline
          </button>
        </form>
      </section>
      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.55rem 0.75rem;
        }
        .field:focus {
          outline: 2px solid color-mix(in oklab, var(--accent) 35%, transparent);
          outline-offset: 1px;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {hint ? (
        <span className="text-xs font-normal leading-5 text-muted">{hint}</span>
      ) : null}
      {children}
    </label>
  );
}
