"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceContext } from "@/lib/team/store";
import { addTicketMessage, createTicket } from "@/lib/tickets/store";
import { TICKET_SCRIPTS, type TicketType } from "@/lib/tickets/scripts";

export async function createTicketAction(
  type: TicketType,
  answers: Record<string, string>,
): Promise<string> {
  const transcript = TICKET_SCRIPTS[type]
    .filter((question) => (answers[question.id] ?? "").trim())
    .map((question) => ({
      question: question.prompt,
      answer: answers[question.id].trim(),
    }));

  const ticketId = await createTicket({ type, answers, transcript });
  revalidatePath("/tickets");
  return ticketId;
}

export async function addWorkspaceTicketMessageAction(
  ticketId: string,
  body: string,
): Promise<void> {
  const context = await requireWorkspaceContext();
  await addTicketMessage({
    ticketId,
    authorUserId: context.userId,
    body,
    scopeWorkspaceId: context.workspaceId,
  });
  revalidatePath(`/tickets/${ticketId}`);
}
