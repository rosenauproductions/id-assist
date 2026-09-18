import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { StatusIcon, StatusPill } from "@/components/status";
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
        <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-stretch gap-2">
              <div className="flex w-56 shrink-0 flex-col gap-2 rounded-xl border border-line bg-card p-4">
                <span className="font-mono text-xs text-muted">
                  {String(stage.order).padStart(2, "0")}
                </span>
                <h3 className="text-base font-semibold">{stage.title}</h3>
                <p className="font-mono text-[11px] text-muted">
                  {stage.file}
                </p>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {stage.chips.map((chip) => (
                    <li
                      key={chip.label}
                      className="flex items-start gap-2 text-xs text-muted"
                    >
                      <StatusIcon
                        status={chip.status}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      <span>{chip.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {index < PIPELINE_STAGES.length - 1 ? (
                <div className="flex items-center text-muted">
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
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
