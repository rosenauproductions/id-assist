import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ticketMessages, tickets, users, workspaces } from "@/lib/db/schema";
import { requireWorkspaceContext } from "@/lib/team/store";
import { synthesizeSummary, type TicketType } from "./scripts";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    value === "open" ||
    value === "in_progress" ||
    value === "resolved" ||
    value === "closed"
  );
}

export type TicketSummary = {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  type: TicketType;
  status: TicketStatus;
  summary: string;
  submittedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketMessage = {
  id: string;
  authorEmail: string | null;
  isAdminAuthor: boolean;
  body: string;
  createdAt: string;
};

export type TicketDetail = TicketSummary & {
  transcript: { question: string; answer: string }[];
  messages: TicketMessage[];
};

/** Creates a ticket from the bot-guided intake's raw answers, scoped to
 * the current user's workspace. */
export async function createTicket(input: {
  type: TicketType;
  answers: Record<string, string>;
  transcript: { question: string; answer: string }[];
}): Promise<string> {
  const context = await requireWorkspaceContext();
  const summary = synthesizeSummary(input.type, input.answers);

  const [row] = await db
    .insert(tickets)
    .values({
      workspaceId: context.workspaceId,
      submittedByUserId: context.userId,
      type: input.type,
      summary: summary || "(no details provided)",
      transcript: input.transcript,
    })
    .returning({ id: tickets.id });

  return row.id;
}

/** Every ticket the current user's workspace has submitted, newest first —
 * the customer-facing list at /tickets. */
export async function listWorkspaceTickets(): Promise<TicketSummary[]> {
  const context = await requireWorkspaceContext();
  const rows = await db
    .select({
      id: tickets.id,
      workspaceId: tickets.workspaceId,
      workspaceName: workspaces.name,
      type: tickets.type,
      status: tickets.status,
      summary: tickets.summary,
      submittedByEmail: users.email,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(users.id, tickets.submittedByUserId))
    .leftJoin(workspaces, eq(workspaces.id, tickets.workspaceId))
    .where(eq(tickets.workspaceId, context.workspaceId))
    .orderBy(desc(tickets.createdAt));

  return rows.map(toSummary);
}

/** Every ticket on the platform, newest first — for /admin/tickets. Filters
 * are applied in application code since the expected volume is small. */
export async function listAllTickets(filters?: {
  type?: TicketType;
  status?: TicketStatus;
}): Promise<TicketSummary[]> {
  const rows = await db
    .select({
      id: tickets.id,
      workspaceId: tickets.workspaceId,
      workspaceName: workspaces.name,
      type: tickets.type,
      status: tickets.status,
      summary: tickets.summary,
      submittedByEmail: users.email,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(users.id, tickets.submittedByUserId))
    .leftJoin(workspaces, eq(workspaces.id, tickets.workspaceId))
    .orderBy(desc(tickets.createdAt));

  return rows
    .map(toSummary)
    .filter((ticket) => !filters?.type || ticket.type === filters.type)
    .filter((ticket) => !filters?.status || ticket.status === filters.status);
}

/** Loads one ticket's full thread. When `workspaceId` is given, access is
 * scoped to that workspace (the customer-facing view); omit it for the
 * admin view, which can open any ticket. */
export async function getTicketDetail(
  ticketId: string,
  scopeWorkspaceId?: string,
): Promise<TicketDetail | null> {
  const [row] = await db
    .select({
      id: tickets.id,
      workspaceId: tickets.workspaceId,
      workspaceName: workspaces.name,
      type: tickets.type,
      status: tickets.status,
      summary: tickets.summary,
      transcript: tickets.transcript,
      submittedByEmail: users.email,
      submittedByUserId: tickets.submittedByUserId,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(users.id, tickets.submittedByUserId))
    .leftJoin(workspaces, eq(workspaces.id, tickets.workspaceId))
    .where(
      scopeWorkspaceId
        ? and(eq(tickets.id, ticketId), eq(tickets.workspaceId, scopeWorkspaceId))
        : eq(tickets.id, ticketId),
    )
    .limit(1);

  if (!row) return null;

  const messageRows = await db
    .select({
      id: ticketMessages.id,
      authorEmail: users.email,
      authorPlatformRole: users.platformRole,
      body: ticketMessages.body,
      createdAt: ticketMessages.createdAt,
    })
    .from(ticketMessages)
    .leftJoin(users, eq(users.id, ticketMessages.authorUserId))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);

  return {
    ...toSummary(row),
    transcript: Array.isArray(row.transcript)
      ? (row.transcript as { question: string; answer: string }[])
      : [],
    messages: messageRows.map((message) => ({
      id: message.id,
      authorEmail: message.authorEmail,
      isAdminAuthor: message.authorPlatformRole === "admin",
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** Appends a reply. `scopeWorkspaceId` restricts a customer to their own
 * workspace's ticket; omit it for an admin reply. */
export async function addTicketMessage(input: {
  ticketId: string;
  authorUserId: string;
  body: string;
  scopeWorkspaceId?: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Reply can't be empty.");

  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      input.scopeWorkspaceId
        ? and(
            eq(tickets.id, input.ticketId),
            eq(tickets.workspaceId, input.scopeWorkspaceId),
          )
        : eq(tickets.id, input.ticketId),
    )
    .limit(1);
  if (!ticket) throw new Error("Ticket not found.");

  await db.insert(ticketMessages).values({
    ticketId: input.ticketId,
    authorUserId: input.authorUserId,
    body,
  });
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, input.ticketId));
}

/** Admin-only status change (see requirePlatformAdmin() at the call site
 * in app/admin/actions.ts). */
export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<void> {
  await db
    .update(tickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
}

function toSummary(row: {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  type: string;
  status: string;
  summary: string;
  submittedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TicketSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    type: row.type as TicketType,
    status: row.status as TicketStatus,
    summary: row.summary,
    submittedByEmail: row.submittedByEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
