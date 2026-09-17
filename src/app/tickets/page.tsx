import Link from "next/link";
import { StatusPill } from "@/components/status";
import { listWorkspaceTickets } from "@/lib/tickets/store";
import { TICKET_TYPE_LABELS } from "@/lib/tickets/scripts";

export default async function TicketsPage() {
  const ticketsList = await listWorkspaceTickets();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Help</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Report something broken, or suggest something that would make this
        better. A quick guided form fills out the ticket for you — no bare
        text box to stare at.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/tickets/new?type=bug"
          className="rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          Report an issue
        </Link>
        <Link
          href="/tickets/new?type=suggestion"
          className="rounded-md border border-line px-4 py-2.5 text-sm font-medium hover:border-accent/40"
        >
          Suggest a feature
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Your tickets
        </h2>
        <ul className="mt-3 grid gap-2">
          {ticketsList.length === 0 ? (
            <li className="rounded-xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-sm text-muted">
              Nothing submitted yet.
            </li>
          ) : (
            ticketsList.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 hover:border-accent/40"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {TICKET_TYPE_LABELS[ticket.type]}
                    </p>
                    <p className="mt-0.5 truncate text-sm">
                      {ticket.summary.split("\n")[0]}
                    </p>
                  </div>
                  <StatusPill status={ticket.status} />
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
