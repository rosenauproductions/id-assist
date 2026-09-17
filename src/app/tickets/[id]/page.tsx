import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/team/store";
import { getTicketDetail } from "@/lib/tickets/store";
import { TicketThread } from "@/components/ticket-thread";
import { addWorkspaceTicketMessageAction } from "../actions";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireWorkspaceContext();
  const ticket = await getTicketDetail(id, context.workspaceId);
  if (!ticket) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/tickets" className="text-sm text-muted hover:text-foreground">
        ← Help
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {ticket.summary.split("\n")[0]}
      </h1>
      <div className="mt-4">
        <TicketThread
          ticket={ticket}
          onReply={async (body) => {
            "use server";
            await addWorkspaceTicketMessageAction(ticket.id, body);
          }}
        />
      </div>
    </main>
  );
}
