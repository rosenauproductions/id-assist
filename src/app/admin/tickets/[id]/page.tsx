import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/store";
import { getTicketDetail } from "@/lib/tickets/store";
import { TicketThread } from "@/components/ticket-thread";
import { addAdminTicketMessageAction, setTicketStatusAction } from "../../actions";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const { id } = await params;
  const ticket = await getTicketDetail(id);
  if (!ticket) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/admin/tickets" className="text-sm text-muted hover:text-foreground">
        ← Tickets
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        {ticket.workspaceName ?? "Unknown account"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {ticket.summary.split("\n")[0]}
      </h1>
      <div className="mt-4">
        <TicketThread
          ticket={ticket}
          onReply={async (body) => {
            "use server";
            await addAdminTicketMessageAction(ticket.id, body);
          }}
          onSetStatus={async (status) => {
            "use server";
            await setTicketStatusAction(ticket.id, status);
          }}
        />
      </div>
    </main>
  );
}
