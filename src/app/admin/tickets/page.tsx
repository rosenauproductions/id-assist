import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/store";
import { listAllTickets, isTicketStatus } from "@/lib/tickets/store";
import { isTicketType, TICKET_TYPE_LABELS } from "@/lib/tickets/scripts";
import { StatusPill } from "@/components/status";
import { AdminTabs } from "@/components/admin-tabs";

const STATUS_FILTERS = ["open", "in_progress", "resolved", "closed"] as const;
const TYPE_FILTERS = ["bug", "suggestion"] as const;

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const params = await searchParams;
  const typeFilter = isTicketType(params.type) ? params.type : undefined;
  const statusFilter = isTicketStatus(params.status) ? params.status : undefined;
  const ticketsList = await listAllTickets({ type: typeFilter, status: statusFilter });

  function filterHref(next: { type?: string; status?: string }) {
    const query = new URLSearchParams();
    const type = next.type ?? typeFilter;
    const status = next.status ?? statusFilter;
    if (type) query.set("type", type);
    if (status) query.set("status", status);
    const qs = query.toString();
    return `/admin/tickets${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Accounts
      </Link>
      <AdminTabs active="tickets" />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Platform admin
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Tickets</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Bug reports and feature suggestions submitted through the in-app
        bot, across every account.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5">
          <FilterLink
            href={filterHref({ type: undefined })}
            active={!typeFilter}
            label="All types"
          />
          {TYPE_FILTERS.map((type) => (
            <FilterLink
              key={type}
              href={filterHref({ type })}
              active={typeFilter === type}
              label={TICKET_TYPE_LABELS[type]}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterLink
            href={filterHref({ status: undefined })}
            active={!statusFilter}
            label="All statuses"
          />
          {STATUS_FILTERS.map((status) => (
            <FilterLink
              key={status}
              href={filterHref({ status })}
              active={statusFilter === status}
              label={status.replace("_", " ")}
            />
          ))}
        </div>
      </div>

      <ul className="mt-6 grid gap-2">
        {ticketsList.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-sm text-muted">
            No tickets match this filter.
          </li>
        ) : (
          ticketsList.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/tickets/${ticket.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 hover:border-accent/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {TICKET_TYPE_LABELS[ticket.type]} · {ticket.workspaceName ?? "Unknown account"}
                  </p>
                  <p className="mt-0.5 truncate text-sm">
                    {ticket.summary.split("\n")[0]}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {ticket.submittedByEmail ?? "Unknown"} ·{" "}
                    {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusPill status={ticket.status} />
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-line text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
