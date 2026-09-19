import Link from "next/link";
import { ArchitectureFlow } from "@/components/architecture-flow";
import { StatusPill } from "@/components/status";
import {
  ARCHITECTURE_UPDATED_AT,
  CROSS_CUTTING,
  GAPS,
  PIPELINE_STAGES,
} from "@/lib/architecture-status";

// Living reference page: what ID Assist's pipeline actually does today,
// traced from source, plus the gaps we're working through. The content is
// plain data in lib/architecture-status.ts — update the arrays there as
// gaps close, this page just renders the current snapshot.

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Reference
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Architecture
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        What the app actually does today, traced from source — gather →
        organize → scrutinize → map → assemble/deliver — plus the known gaps
        we&apos;re working through. Updated {ARCHITECTURE_UPDATED_AT}.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Pipeline
        </h2>
        <ArchitectureFlow stages={PIPELINE_STAGES} />
        <p className="mt-1 text-center text-xs text-danger">
          dashed line — approval is soft: editing the outline or running
          AI refine after approval sends it back for review and clears out
          any delivery files you’d already generated
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Gaps &amp; roadmap
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {GAPS.map((gap) => (
            <div
              key={gap.id}
              className="flex items-start gap-4 rounded-xl border border-line bg-card p-4"
            >
              <StatusPill status={gap.status} />
              <div>
                <h3 className="text-sm font-semibold">{gap.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {gap.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Cross-cutting
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {CROSS_CUTTING.map((note) => (
            <div
              key={note.label}
              className="rounded-xl border border-line bg-card p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {note.label}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {note.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
